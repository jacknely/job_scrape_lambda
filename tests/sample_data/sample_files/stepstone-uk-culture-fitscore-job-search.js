(function() {
  if (window.analytics.MemberId === null || window.analytics.MemberId === '' || window.analytics.LoggedInState === '') {
    const maxIterations = 4;
    var countIterations = 0;

    const interval = setInterval(function() {
      if (countIterations === maxIterations) return clearInterval(interval);

      if (window.analytics.MemberId === null || window.analytics.MemberId === '' || window.analytics.LoggedInState === '') {
        countIterations++;
      } else {
        clearInterval(interval);
        main();
      }
    }, 500);
  } else {
    main();
  }


  function main() {
    const screens = {
      GET_STARTED_SCREEN: 1,
      CONSENT_SCREEN: 2,
      WIDGET_SCREEN: 3,
      FINAL_SCREEN: 4
    };

    const storageKeys = {
      LAST_EXCHANGED_AUTH_TOKEN: 'gcLastExchangedAuthToken',
      IS_CLICKED_CULTURE_FITSCORE_CTA: 'gcIsClickedCultureFitscoreCta'
    };

    const payload = JSON.parse(document.getElementById('goodco-culture-fitscore-script').getAttribute('data-params'));
    const state = {
      jobIndex: payload.jobIndex,
      queryParams: payload.queryParams,
      hosts: payload.hosts,
      env: payload.env,
      loggedIn: (window.analytics.LoggedInState === "Hard") || (window.analytics.LoggedInState === "Soft"),
      memberId: window.analytics.MemberId,
      isModalReady: false,
      isWidgetReady: false,
      isJobFitscoreReady: false,
      accessToken: null,
      quizzesPassed: 0,
      firstQuizPassedInCurrentSession: false,
      candidateReportUrl: null,
      get currentScreenID() { return this._currentScreenID; },
      set currentScreenID(screenID) {
        this._currentScreenID = screenID;

        if (!inlineContainer()) {
          const jobs = queryElements('.job-results > .job');
          jobs[state.jobIndex].insertAdjacentHTML('beforebegin', getStyles() + getInlineContainerTemplate());
        }

        if (!modalContainer()) {
          const modalContainer = document.createElement('div');
          modalContainer.id = 'gc-modal-container';
          modalContainer.innerHTML = getModalContainerTemplate();
          document.body.appendChild(modalContainer);
        }

        switch (screenID) {
          case screens.GET_STARTED_SCREEN: updateGetStartedScreen(); break;
          case screens.CONSENT_SCREEN: updateConsentScreen(); break;
          case screens.WIDGET_SCREEN: updateWidgetScreen(); break;
          case screens.FINAL_SCREEN: updateFinalScreen(); break;
          default: return null;
        }
      }
    };

    const WIDGET_NAME = 'culture-fitscore';
    const MOUNT_SCRIPT = state.hosts.goodco + '/widget/mount/stepstone-uk.js';

    preloadScript(MOUNT_SCRIPT);

    if (state.loggedIn) {
      preloadScript(state.hosts.goodco + '/widget/js/' + WIDGET_NAME + '.js');

      queryElements('.job:not(.applied) .detail-list').forEach(function(item) { item.innerHTML += '<li class="gc-job-fitscore"></li>'; });

      const lastExchangedAuthToken = window.sessionStorage.getItem(storageKeys.LAST_EXCHANGED_AUTH_TOKEN);
      if (state.queryParams.authorisationToken && state.queryParams.authorisationToken !== lastExchangedAuthToken) {
        state.currentScreenID = screens.WIDGET_SCREEN;
      } else {
        fetchConsentStatus(function(err) {
          if (err) {
            const isAuthReferrer = document.referrer.toLowerCase().indexOf('account/signin') !== -1 || document.referrer.toLowerCase().indexOf('account/register') !== -1;
            if (isAuthReferrer && isClickedCultureFitscoreCta()) {
              state.currentScreenID = screens.CONSENT_SCREEN;
            } else {
              state.currentScreenID = screens.GET_STARTED_SCREEN;
            }
          } else {
            state.currentScreenID = screens.WIDGET_SCREEN;
          }
        });
      }
    } else {
      state.currentScreenID = screens.GET_STARTED_SCREEN;
    }

    // ------------------------------------------

    function updateGetStartedScreen() {
      if (!inlineContainer().innerHTML) {
        inlineContainer().innerHTML = inlineScreenTemplate();
        queryElements('#gc-inline-container .gc-button, #gc-inline-container .gc-title').forEach(function(element) {
          element.addEventListener('click', function(e) {
            e.preventDefault();
            setClickCultureFitscoreCta();

            if (element.classList.contains('gc-title')) {
              sendClickCtaHeaderTrackingEvent();
            } else {
              sendClickCtaTrackingEvent(screens.GET_STARTED_SCREEN);
            }

            if (state.loggedIn) {
              if (state.isModalReady) {
                state.currentScreenID = screens.WIDGET_SCREEN;
              } else {
                state.currentScreenID = screens.CONSENT_SCREEN;
              }
            } else {
              window.location = window.location.origin + '/account/signin?ReturnUrl=' + window.location.pathname + window.location.search;
            }
          });
        });

        sendAppearCtaTrackingEvent(screens.GET_STARTED_SCREEN);
      }

      inlineContainer().style.display = 'block';
    }

    function updateConsentScreen() {
      if (!state.isModalReady) {
        const content = modalConsentTemplate();
        setupModalContainer(content);

        modalContainer().querySelector('.gc-button').addEventListener('click', function(e) {
          e.preventDefault();
          setClickCultureFitscoreCta();
          sendClickCtaTrackingEvent(screens.CONSENT_SCREEN);

          state.currentScreenID = screens.WIDGET_SCREEN;
        });
      }

      openModal();
    }

    function updateWidgetScreen() {
      if (state.isWidgetReady) {
        openModal();
      } else {
        inlineContainer().style.display = 'none';
        modalContainer().style.display = 'none';
        modalContainer().querySelector('.gc-body').dataset.isWidget = '';

        const content = getMountTemplate();
        setupModalContainer(content);
        addMountScriptToDOM();

        document.addEventListener('gcWidgetReady', function() { state.isWidgetReady = true; });
        ['gcEmailInUse', 'gcFirstQuizNotComplete'].forEach(function(eventName) { document.addEventListener(eventName, function() { openModal(); }); });
        document.addEventListener('gcStrengthsCardAvailable', function(e) {
          if (!state.accessToken) {
            state.accessToken = e.detail.userData.access_token;
            state.quizzesPassed = e.detail.userData.quizProgress.reduce(function(accumulator, quiz) {
              return (quiz.attributes.status === 'completed' && quiz.attributes.name !== 'quiz_001') ? accumulator + 1 : accumulator;
            }, 1);
            state.currentScreenID = screens.FINAL_SCREEN;
          }
        });
        document.addEventListener('gcQuizPassed', function(e) {
          if (e.detail.quizName === 'quiz_001') {
            state.firstQuizPassedInCurrentSession = true;
          } else {
            state.quizzesPassed += 1;
            setupJobFitscores();
          }
        });
      }
    }

    function updateFinalScreen() {
      if (!state.isJobFitscoreReady) {
        var eventName = 'click';
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent)) eventName = 'touchend';

        document.body.addEventListener(eventName, function(e) {
          const isFitscoreContainer = composedPath(e.target, 'gc-job-fitscore');
          if (!isFitscoreContainer) {
            queryElements('.gc-fitscore-modal').forEach(function(modal) { modal.style.display = 'none'; });
          }
        });

        inlineContainer().innerHTML = getFinalInlineScreenTemplate();
        inlineContainer().style.background = '#fff';
        inlineContainer().style.minHeight = '200px';
        inlineContainer().style.display = 'block';
        inlineContainer().querySelector('.gc-final-button').addEventListener('click', function() {
          sendDownloadedReportTrackingEvent(screens.FINAL_SCREEN);

          if (state.candidateReportUrl) {
            window.open(state.candidateReportUrl, '_blank');
          } else {
            inlineContainer().querySelector('.gc-final-button').innerHTML = getReportButtonLoadingState();
            var candidateReportTab = window.open(state.hosts.goodco + '/land/report/loading', '_blank');

            fetchUserReport(function(err, response) {
              if (err) return;

              state.candidateReportUrl = response.data.attributes.candidate_report;

              inlineContainer().querySelector('.gc-final-button').innerHTML = getReportButtonDownloadState();
              candidateReportTab.location = state.candidateReportUrl;
            });
          }
        });

        setupJobFitscores();
        sendAppearCtaTrackingEvent(screens.FINAL_SCREEN);

        state.isJobFitscoreReady = true;
      }
    }

    function setupJobFitscores() {
      var jobs = queryElements('.job[id]:not(.applied)');
      var jobsFetched = [];
      var jobsShown = [];
      var canFireAppearEvent = !state.isJobFitscoreReady;
      var onFetchFitscore = function(job, showFitscore) {
        jobsFetched.push(job);
        if (showFitscore) jobsShown.push(job);

        if (canFireAppearEvent && jobs.length === jobsFetched.length) sendAppearCultureFitscoreTrackingEvent();
      };

      jobs.forEach(function(job) {
        var jobTitle = job.querySelector('.job-title h2').innerText;
        var companyName = job.querySelector('.company a').innerText;

        fetchJobseekerFitscores([{ job_id: job.id, job_title: jobTitle }], function(err, response) {
          if (err) return;

          const jobItem = response.data[0];
          const showFitscore = jobItem.attributes.fitscore >= 70;

          if (showFitscore) {
            const fitscoreEl = document.querySelector('[id="'+jobItem.id+'"] .detail-list .gc-job-fitscore');
            fitscoreEl.innerHTML = '<a class="gc-fitscore-text" href="">Culture Fitscore</a> <span class="gc-fitscore-number">'+jobItem.attributes.fitscore+'</span>'+getFitscoreModalTemplate(jobItem.attributes.strength_words, state.quizzesPassed);

            fitscoreEl.querySelector('.gc-fitscore-text').addEventListener('click', function(e) {
              e.preventDefault();

              sendClickCultureFitscoreTrackingEvent(jobTitle, companyName);
              queryElements('.gc-fitscore-modal').forEach(function(modal) { modal.style.display = 'none'; });
              e.target.parentElement.querySelector('.gc-fitscore-modal').style.display = 'block';
            });

            fitscoreEl.querySelector('.gc-fitscore-number').addEventListener('click', function(e) {
              sendClickCultureFitscoreTrackingEvent(jobTitle, companyName);
              queryElements('.gc-fitscore-modal').forEach(function(modal) { modal.style.display = 'none'; });
              e.target.parentElement.querySelector('.gc-fitscore-modal').style.display = 'block';
            });

            fitscoreEl.querySelector('.gc-fitscore-modal .gc-close').addEventListener('click', function(e) {
              const modalEl = composedPath(e.target, 'gc-fitscore-modal');
              modalEl.style.display = 'none';
            });

            if (fitscoreEl.querySelector('.gc-fitscore-modal .gc-button')) {
              fitscoreEl.querySelector('.gc-fitscore-modal .gc-button').addEventListener('click', function(e) {
                sendClickImproveAccuracyTrackingEvent(jobTitle, companyName);

                var event = document.createEvent('CustomEvent');
                event.initCustomEvent('gcImproveAccuracyClicked', false, false, null);
                document.dispatchEvent(event);

                setClickCultureFitscoreCta();
                state.currentScreenID = screens.WIDGET_SCREEN;

                const modalEl = composedPath(e.target, 'gc-fitscore-modal');
                modalEl.style.display = 'none';
              })
            }

            fitscoreEl.style.visibility = 'visible';
          }

          onFetchFitscore(jobItem, showFitscore);
        });
      });
    }

    function setupModalContainer(content) {
      modalContainer().querySelector('.gc-content').innerHTML = content;

      if (!state.isModalReady) {
        modalContainer().addEventListener('click', function(e) {
          const isInModal = composedPath(e.target, 'gc-body');
          const isCloseClicked = composedPath(e.target, 'gc-close');
          const isCtaClicked = composedPath(e.target, 'gc-cta');

          if (!isCtaClicked && (!isInModal || isCloseClicked)) {
            if (state.currentScreenID === screens.CONSENT_SCREEN) sendClickCloseTrackingEvent(screens.CONSENT_SCREEN);

            state.currentScreenID = state.isJobFitscoreReady ? screens.FINAL_SCREEN : screens.GET_STARTED_SCREEN;

            document.body.style.overflow = '';
            modalContainer().style.display = 'none';
          }
        });
      }

      state.isModalReady = true;
    }

    function openModal() {
      if (isClickedCultureFitscoreCta()) {
        document.body.style.overflow = 'hidden';

        modalContainer().style.display = 'flex';
        resetClickCultureFitscoreCta();

        if (state.currentScreenID === screens.CONSENT_SCREEN) sendAppearCtaTrackingEvent(screens.CONSENT_SCREEN);
      } else {
        state.currentScreenID = screens.GET_STARTED_SCREEN;
      }
    }

    function sendTrackingEvent(eventName, eVars, action) {
      if (!window.s_gi || !window.analLib) return;

      var s = window.s_gi(window.analLib.getSiteId());
      if (s !== null) {
        s.linkTrackVars = eVars.reduce(function(accumulator, eVar) { return eVar.key + ',' + accumulator }, 'events,eVar1,eVar23,eVar30');
        s.linkTrackEvents = eventName;
        s.events = eventName;

        eVars.forEach(function(eVar) {
          if (eVar.key && eVar.value) s[eVar.key] = eVar.value;
        });

        s.tl(true, 'o', action);

        // reset
        s.events = null;
        eVars.forEach(function(eVar) {
          if (eVar.key && eVar.value) s[eVar.key] = undefined;
        });
      }
    }

    function getTrackingCode(screenID) {
      switch (screenID) {
        case screens.GET_STARTED_SCREEN:
          return 'Jobs|Culture_Fitscore_Banner_GetStarted|Default';
        case screens.CONSENT_SCREEN:
          return 'Jobs|Culture_Fitscore_Banner_ModalConsent|Default';
        case screens.FINAL_SCREEN:
          return 'Jobs|Culture_Fitscore_Banner_DownloadReport|Default';
        default:
          return null;
      }
    }

    function sendAppearCtaTrackingEvent(screenID) {
      sendTrackingEvent('event115', [{ key: 'eVar115', value: getTrackingCode(screenID) }], 'Good&Co CTA appeared');
    }

    function sendClickCtaTrackingEvent(screenID) {
      sendTrackingEvent('event116', [{ key: 'eVar115', value: getTrackingCode(screenID) }], 'Good&Co CTA/Widget Clicked');
    }

    function sendClickCtaHeaderTrackingEvent() {
      sendTrackingEvent('event116', [{ key: 'eVar115', value: 'Jobs|Culture_Fitscore_Banner_Link|Default' }], 'Good&Co CTA/Widget Clicked');
    }

    function sendClickCloseTrackingEvent(screenID) {
      sendTrackingEvent('event117', [{ key: 'eVar115', value: getTrackingCode(screenID) }], 'Good&Co CTA closed');
    }

    function sendDownloadedReportTrackingEvent(screenID) {
      sendTrackingEvent('event118', [{ key: 'eVar115', value: getTrackingCode(screenID) }], 'Good&Co report downloaded');
    }

    function sendAppearCultureFitscoreTrackingEvent() {
      sendTrackingEvent('event115', [
        { key: 'eVar115', value: 'Jobs|Culture_Fitscore_Banner_JobCard|Default' },
        { key: 'list2' },
        { key: 'list3' }
      ], 'Good&Co CTA appeared');
    }

    function sendClickCultureFitscoreTrackingEvent(jobTitle, companyName) {
      sendTrackingEvent('event116', [
        { key: 'eVar115', value: 'Jobs|Culture_Fitscore_Banner_JobCard|Default' },
        { key: 'eVar33', value: jobTitle },
        { key: 'eVar34', value: companyName },
        { key: 'list2' },
        { key: 'list3' }
      ], 'Good&Co CTA/Widget Clicked');
    }

    function sendClickImproveAccuracyTrackingEvent(jobTitle, companyName) {
      sendTrackingEvent('event116', [
        { key: 'eVar115', value: 'Jobs|Culture_Fitscore_Banner_ImproveAccuracy|Default' },
        { key: 'eVar33', value: jobTitle },
        { key: 'eVar34', value: companyName }
      ], 'Good&Co CTA/Widget Clicked');
    }

    function isClickedCultureFitscoreCta() { return window.sessionStorage.getItem(storageKeys.IS_CLICKED_CULTURE_FITSCORE_CTA); }
    function setClickCultureFitscoreCta() { window.sessionStorage.setItem(storageKeys.IS_CLICKED_CULTURE_FITSCORE_CTA, '1'); }
    function resetClickCultureFitscoreCta() { window.sessionStorage.removeItem(storageKeys.IS_CLICKED_CULTURE_FITSCORE_CTA); }

    function fetchConsentStatus(cb) {
      const anonymousTokens = {
        dev: '84f2e04f259874b200cfb3194b8f779c4aa219b1591efed79cd336f468a86619',
        pat: '84f2e04f259874b200cfb3194b8f779c4aa219b1591efed79cd336f468a86619',
        live: '43d30b47e3848c811d91a5acbe16c697c69a336150684d92631a837bd32b76b4'
      };

      const url = state.hosts.goodcoApi + '/v2/social_profile_in_use?social_user_id=' + state.memberId + '&social_provider=stepstoneuk';
      const options = {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + anonymousTokens[state.env]
        }
      };

      httpRequest(url, options, cb);
    }

    function fetchJobseekerFitscores(jobList, cb) {
      var url = state.hosts.goodcoApi + '/v2/jobseeker_fitscores';
      var options = {
        method: 'POST',
        body: {
          data: {
            type: 'jobseeker_fitscores',
            attributes: jobList
          }
        },
        headers: {
          'Content-type': 'application/json',
          'Authorization': 'Bearer ' + state.accessToken
        }
      };

      httpRequest(url, options, cb);
    }

    function fetchUserReport(cb) {
      var url = state.hosts.goodcoApi + '/v2/users/me/report';
      var options = {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + state.accessToken
        }
      };

      httpRequest(url, options, cb);
    }

    function httpRequest(url, options, cb) {
      options = options || {};
      options.method = options.method || 'GET';
      options.headers = options.headers || {};
      options.body = options.body ? JSON.stringify(options.body) : undefined;

      var xhr = new XMLHttpRequest();
      xhr.open(options.method, url);

      for (var headerName in options.headers) {
        xhr.setRequestHeader(headerName, options.headers[headerName]);
      }

      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status >= 200 && xhr.status <= 299) {
            cb(null, JSON.parse(xhr.response));
          } else {
            cb(xhr.response || true);
          }
        }
      };

      xhr.send(options.body);
    }

    function addMountScriptToDOM() {
      const mountNodeId = document.getElementById('gc-ststuk-widget-mount-pt');

      const script = document.createElement('script');
      script.src = MOUNT_SCRIPT;
      mountNodeId.appendChild(script);
    }

    function preloadScript(src) {
      var preloadLink = document.createElement('link');
      preloadLink.href = src;
      preloadLink.rel = 'preload';
      preloadLink.as = 'script';
      document.head.appendChild(preloadLink);
    }

    function queryElements(query) { return Array.prototype.slice.call(document.querySelectorAll(query)); }
    function inlineContainer() { return document.querySelector('#gc-inline-container'); }
    function modalContainer() { return document.querySelector('#gc-modal-container'); }

    function composedPath(target, className) {
      if (target.className === className) {
        return target;
      } else {
        const parentEl = target.parentNode;
        if (parentEl) {
          return composedPath(parentEl, className);
        } else {
          return false;
        }
      }
    }

    // ------
    function getStyles() {
      return '<style>.center-align{margin:0 auto}.gc-button{display:block;border-radius:3px;text-decoration:none;text-align:center;font-size:14px;padding:10px 0;font-weight:400;cursor:pointer;width:160px;position:relative}.gc-button:hover{text-decoration:none}#gc-inline-container{position:relative;display:none;outline:0;background-color:#f7f8fa;box-shadow:0 0 5px 0 #ccc;border-radius:4px;padding:12px 12px 19px 12px;margin-top:12px;min-height:250px;overflow:hidden}#gc-inline-container .gc-main-banner .gc-background-dots{background:url(https://good.co/images/tealium/culture-fitscore-dots-background.png) no-repeat;background-size:100%;position:absolute;right:100px;bottom:15px;width:235px;height:170px}#gc-inline-container .gc-main-banner .gc-background{background:url(https://good.co/images/tealium/culture-fitscore-banner-image-desktop.png) no-repeat;background-size:cover;position:absolute;right:0;bottom:0;width:245px;height:220px}#gc-inline-container .gc-main-banner .gc-background-leaf{background:url(https://good.co/images/tealium/leaf-post-apply-background.png) no-repeat;background-size:cover;position:absolute;left:-11px;width:306px;height:129px}#gc-inline-container .gc-title{display:block;cursor:pointer;font-size:21px;font-weight:700;line-height:1.52;letter-spacing:.45px;text-decoration:none}#gc-inline-container .gc-description{width:70%;font-size:20px;line-height:1.6;color:#404040;margin-top:20px}#gc-inline-container .gc-description-variation{width:60%;font-size:20px;line-height:1.6;color:#404040;margin-top:20px}#gc-inline-container .gc-main-banner .gc-bottom-block{clear:both;padding-top:65px}#gc-inline-container .gc-cta{display:inline-block;width:180px}#gc-inline-container .gc-powered-by{display:inline-block;width:125px}#gc-inline-container .gc-powered-by img{width:100%}#gc-inline-container .gc-terms{font-size:10px;font-weight:400;line-height:12px;letter-spacing:0;color:#b2b2b2;margin-top:30px}#gc-inline-container .gc-terms a{text-decoration:none}#gc-inline-container .gc-final-title{font-family:Montserrat;font-size:19px;font-weight:700;color:#5346b7;line-height:1.26}#gc-inline-container .gc-final-description{width:58%;font-family:Montserrat;font-size:14px;color:#5346b7;font-weight:500;line-height:1.71;margin:20px 0}#gc-inline-container .gc-final-background{background:url(https://good.co/images/tealium/culture-fitscore-final-image.png) no-repeat;background-size:100%;position:absolute;right:50px;bottom:30px;width:270px;height:145px}#gc-inline-container .gc-final-background .gc-final-background-dots{background:url(https://good.co/images/tealium/culture-fitscore-dots-background.png) no-repeat;background-size:cover;position:absolute;right:190px;bottom:10px;width:220px;height:130px}#gc-inline-container .gc-final-button{display:inline-block;font-family:Montserrat;font-size:12px;font-weight:900;background-image:linear-gradient(to left,#585aea 0,#8c58ea 60%,#8c58ea 100%);border-radius:20px;padding:11px 25px;border:none;color:#fff;width:158px;height:40px}#gc-inline-container .gc-final-button:hover{opacity:.75}#gc-inline-container .gc-final-report-loading:after{position:absolute;overflow:hidden;display:inline-block;vertical-align:bottom;animation:ellipsis steps(4,end) .9s infinite;content:"...";width:0}@keyframes ellipsis{to{width:15px}}@-webkit-keyframes ellipsis{to{width:15px}}#gc-inline-container .gc-final-button svg{width:18px;margin-right:10px;vertical-align:bottom}#gc-inline-container .gc-final-button-description{display:inline-block;width:255px;font-family:Montserrat;font-size:12px;line-height:1.33;color:#5346b7;margin-left:15px;vertical-align:middle}#gc-inline-container .gc-final-powered-by{width:125px;margin-top:10px;margin-left:10px}#gc-inline-container .gc-final-powered-by img{width:100%}#gc-modal-container{display:none;flex-direction:column;position:fixed;z-index:99999999;left:0;top:0;width:100%;height:100%;overflow-x:hidden;overflow-y:auto;background-color:rgba(0,0,0,.4)}#gc-modal-container .gc-body{background-color:#fefefe;margin:auto;padding:20px;border:1px solid #888;border-radius:4px;width:571px;position:relative}#gc-modal-container .gc-body[data-is-widget]{width:400px}#gc-modal-container .gc-close{position:absolute;right:10px;top:10px;background:0 0;border:none;width:30px;padding:0;height:30px;z-index:1}#gc-modal-container .gc-consent-title{font-size:20px;font-weight:700;margin-right:70px;line-height:1.6;letter-spacing:.43px}#gc-modal-container .gc-consent-points{margin:30px 0}#gc-modal-container .gc-consent-points ul{padding-left:20px}#gc-modal-container .gc-consent-points ul li{font-size:14px;margin:3px 0}#gc-modal-container .gc-cta{margin-bottom:40px}#gc-modal-container .gc-button{margin:0 auto}#gc-modal-container .gc-terms{text-align:center;font-size:10px;font-weight:400;line-height:16px;letter-spacing:0;color:#b2b2b2}#gc-modal-container .gc-terms a{text-decoration:none}#gc-modal-container .gc-terms a:hover{text-decoration:underline}#gc-modal-container .gc-terms p{margin-top:15px}.gc-job-fitscore{position:relative;width:145px;height:21px;background:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 21 21\'%3E%3Cg fill=\'%23a5a5a5\' fill-rule=\'evenodd\'%3E%3Cpath d=\'M15.181 3.741H5.775c-1.034 0-1.872.805-1.872 1.797v9.033c0 .992.838 1.797 1.872 1.797h9.406c1.034 0 1.872-.805 1.872-1.797V9.612a.367.367 0 0 0-.375-.36h-5.163a.367.367 0 0 0-.375.36v.813c0 .199.168.36.375.36h.338c.254 0 .498.118.635.323.47.702-.044 1.439-.736 1.439h-.779c-.92 0-1.668-.717-1.668-1.602V9.092c0-.884.747-1.601 1.668-1.601h5.705c.207 0 .375-.161.375-.36V5.538c0-.992-.838-1.797-1.872-1.797\'%3E%3C/path%3E%3Cpath d=\'M4.398 18.127c-1.124 0-2.062-.759-2.292-1.772a2.229 2.229 0 0 1-.04-.23v-.007a2.128 2.128 0 0 1-.015-.244V4.223c0-1.245 1.05-2.253 2.347-2.253h12.135c1.123 0 2.061.759 2.291 1.771.017.076.03.153.04.23v.008c.01.08.015 11.895.015 11.895a2.18 2.18 0 0 1-.4 1.26 2.333 2.333 0 0 1-1.09.836 2.42 2.42 0 0 1-.856.157H4.398zM20.918 3.74h-.003C20.761 1.651 18.951 0 16.735 0H4.195c-.723 0-1.405.176-2 .486A4.136 4.136 0 0 0 .507 2.108 3.886 3.886 0 0 0 0 4.028v12.04c0 .096.005.192.012.287h.003c.154 2.09 1.965 3.741 4.18 3.741h12.54c.434 0 .853-.063 1.247-.18 1.183-.354 2.141-1.196 2.619-2.28a3.881 3.881 0 0 0 .33-1.568V4.028c0-.096-.005-.192-.012-.287z\'%3E%3C/path%3E%3Cpath d=\'M15.197 3.744H5.784c-1.034 0-1.873.805-1.873 1.798v9.039c0 .993.839 1.798 1.873 1.798h9.413c1.034 0 1.873-.805 1.873-1.798V9.618a.367.367 0 0 0-.375-.36h-5.167a.367.367 0 0 0-.375.36v.814c0 .199.168.36.375.36h.339c.254 0 .498.118.635.324.47.702-.044 1.439-.737 1.439h-.779c-.922 0-1.669-.718-1.669-1.603V9.098c0-.885.747-1.602 1.67-1.602h5.708a.367.367 0 0 0 .375-.36V5.542c0-.993-.839-1.798-1.873-1.798\'%3E%3C/path%3E%3C/g%3E%3C/svg%3E") no-repeat 0 3px;visibility:hidden}.gc-fitscore-number{cursor:pointer;color:#5e5aeb;font-size:12px;font-weight:700;background:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'30\' height=\'27\' viewBox=\'0 0 45 23\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill-rule=\'nonzero\' stroke-linecap=\'round\' stroke-width=\'5\'%3E%3Cpath stroke=\'%23d5d5d5\' stroke-opacity=\'.7\' d=\'M42.396 21.498c0-11.038-8.907-19.987-19.894-19.987-10.987 0-19.894 8.949-19.894 19.987\'/%3E%3Cpath stroke=\'%235d5aeb\' d=\'M32.417 4.167a19.731 19.731 0 0 0-9.915-2.656c-10.987 0-19.894 8.949-19.894 19.987\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A") no-repeat 0 0;position:absolute;bottom:3px;left:115px;padding-top:10px;padding-left:8px;width:33px;height:23px}.gc-fitscore-modal{display:none;position:absolute;left:0;top:32px;width:370px;padding:10px;z-index:2;background:#f5f5fa;box-shadow:0 2px 4px 0 rgba(0,0,0,.5);border-radius:4px}.gc-fitscore-modal:after{content:"";width:15px;height:15px;transform:rotate(-45deg);background:#f5f5fa;position:absolute;top:-10px;left:122px}.gc-fitscore-modal .gc-close{position:absolute;right:8px;top:8px;width:14px;height:17px;background:0 0;border:none;padding:0}.gc-fitscore-modal .gc-top-bar{transform:rotate(45deg);transform-origin:15% 10%;width:17px;background-color:#666;height:2px;border-radius:1px;display:block}.gc-fitscore-modal .gc-bottom-bar{transform:rotate(-45deg);transform-origin:15% 90%;margin-top:6px;width:17px;background-color:#666;height:2px;border-radius:1px;display:block}.gc-fitscore-modal .gc-title{font-size:22px;font-weight:700}.gc-fitscore-modal .gc-description{font-size:12px;line-height:1.33;margin-top:10px;margin-bottom:15px}.gc-fitscore-modal .gc-strengthcard-title{font-weight:700;font-size:12px;margin-bottom:5px}.gc-fitscore-modal .gc-strengthword{font-size:10px;font-weight:700;color:#fff;padding:3px 5px;background:#32d3ea;margin:0 2px;border-radius:2px}.gc-fitscore-modal .gc-divider{width:100%;height:1px;background-color:#dedede;margin-top:15px;margin-bottom:7px}.gc-fitscore-modal .gc-quiz-description{font-size:12px;letter-spacing:.26;color:#000}.gc-fitscore-modal .gc-quiz-progress-wrapper{text-align:center;margin-top:15px}.gc-fitscore-modal .gc-quiz-progress-wrapper .gc-progress-img{height:41px}.gc-fitscore-modal .gc-button{margin:15px auto 5px;padding:5px 0}.gc-fitscore-modal .gc-powered-by{margin-top:15px;font-size:10px;text-align:center}.gc-fitscore-modal .gc-powered-by span{color:#8e8e93}.gc-fitscore-modal .gc-powered-by a{color:#585aea;text-decoration:underline}.gc-fitscore-modal .gc-powered-by a:hover{text-decoration:none}@media screen and (max-width:1199px){#gc-inline-container .gc-description,#gc-inline-container .gc-title{font-size:19px}#gc-inline-container .gc-final-background{right:0}}@media screen and (max-width:991px),screen and (max-width:570px){#gc-inline-container{min-height:300px}#gc-inline-container .gc-main-banner .gc-background-dots{right:initial;bottom:25px;width:270px;height:205px;transform:scaleX(-1)}#gc-inline-container .gc-main-banner .gc-background-leaf{background:url(https://good.co/images/tealium/leaf-post-apply-background.png) no-repeat;background-size:cover;position:absolute;left:0;width:100%;max-width:306px;height:129px;margin:auto;right:-17px}#gc-inline-container .gc-main-banner .gc-background{background:url(https://good.co/images/tealium/culture-fitscore-banner-image-mobile.png) no-repeat;background-size:cover;width:230px;height:80px;position:unset;margin:10px auto}#gc-inline-container .gc-title{font-size:18px;text-align:center}#gc-inline-container .gc-description{font-size:18px;width:100%;text-align:center}#gc-inline-container .gc-description-variation{font-size:18px;width:100%;text-align:center}#gc-inline-container .gc-main-banner .gc-bottom-block{padding-top:20px}#gc-inline-container .gc-cta{display:block;margin:0 auto;width:180px}#gc-inline-container .gc-powered-by{display:block;margin:0 auto;margin-top:10px}#gc-modal-container .gc-body{width:480px;padding:15px}#gc-modal-container .gc-body[data-is-widget]{width:400px}#gc-inline-container .gc-terms{margin-top:20px}#gc-inline-container .gc-final-title{text-align:center}#gc-inline-container .gc-final-description{width:74%;margin:20px auto;text-align:center}#gc-inline-container .gc-final-background{background-size:100%;position:relative;bottom:0;width:250px;margin:0 auto}#gc-inline-container .gc-final-background .gc-final-background-dots{top:32px;right:0;left:-78px;width:350px;height:140px;transform:scaleX(-1)}#gc-inline-container .gc-final-button{display:block;margin:10px auto}#gc-inline-container .gc-final-button-description{display:block;width:55%;text-align:center;margin:0 auto}#gc-inline-container .gc-final-powered-by{margin:10px auto}#gc-modal-container .gc-consent-title{font-size:16px;margin-right:30px}#gc-modal-container .gc-consent-points ul li{margin:10px 0}}@media screen and (max-width:480px){#gc-inline-container .gc-description{font-size:16px}#gc-inline-container .gc-description-variation{font-size:16px}#gc-inline-container .gc-cta{width:170px}#gc-inline-container .gc-final-description{width:100%}#gc-inline-container .gc-final-button-description{width:100%}#gc-modal-container .gc-body{width:320px;padding:12px}#gc-modal-container .gc-body[data-is-widget]{width:320px;padding:12px 12px 5px}#gc-modal-container .gc-consent-title{font-size:14px;margin-right:30px}.gc-fitscore-modal{width:280px}}</style>';
    }

    function getInlineContainerTemplate() {
      return '<div id="gc-inline-container" class="clearfix center-align"></div>';
    }

    function getModalContainerTemplate() {
      const closeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 32 32"> <g fill="none" fill-rule="evenodd" transform="translate(1 1)"> <circle cx="15" cy="15" r="15" stroke="#D4D4D4"/> <path fill="#D4D4D4" fill-rule="nonzero" d="M20.858 9.142a.485.485 0 0 0-.685 0L9.142 20.172a.485.485 0 1 0 .686.686l11.03-11.03a.485.485 0 0 0 0-.686z"/> <path fill="#D4D4D4" fill-rule="nonzero" d="M20.858 20.172L9.828 9.142a.485.485 0 1 0-.686.685l11.03 11.031a.483.483 0 0 0 .686 0 .485.485 0 0 0 0-.686z"/> </g> </svg>';

      return '<div class="gc-body"><button type="button" class="gc-close">'+closeSvg+'</button><div class="gc-content"></div></div>';
    }

    function inlineScreenTemplate() {
      var title = 'You’re searching for the perfect job, but is it the best fit for you?';
      var description = 'Take our <b>3-minute quiz</b> to uncover your strengths and personalised fitscores for these roles';
      var ctaText = 'Start 3-minute quiz';

      return '<div class="gc-main-banner"><a class="gc-title">' + title + '</a><div class="gc-description-variation">' + description + '</div><div class="gc-background"><div class="gc-background-dots"></div></div><div class="gc-bottom-block"><div class="gc-cta"><a class="gc-button btn-primary" href="">' + ctaText + '</a></div><div class="gc-powered-by"><img src="https://good.co/images/tealium/powered-by-logo.png"/></div></div></div>';
    }

    function getMountTemplate() {
      const quizzes = '[&quot;quiz_002&quot;, &quot;quiz_003&quot;, &quot;quiz_004&quot;, &quot;quiz_005&quot;]';
      const widgetParams = '{ &quot;quizzes&quot;: ' + quizzes + ', &quot;required_quizzes&quot;: ' + quizzes + '}';

      return '<div data-client-id="25e0afee-1c53-4308-866e-585843e7c988" id="gc-ststuk-widget-mount-pt" data-brand="stepstoneuk" data-env="' + state.env + '" data-auth-proxy-url="' + state.hosts.stepstoneApi + '" style="display: block;" data-goodco-widget-name="' + WIDGET_NAME + '" data-goodco-widget-params="' + widgetParams + '"></div>';
    }

    function modalConsentTemplate() {
      const title = 'Join three million other applicants by taking our world renowned 3 minute personality quiz';
      const points = [
        'Discover hidden strengths and soft skills',
        'Standout from other applicants by including your personality profile',
        'Find culture fit jobs and companies where you can thrive'
      ];
      const ctaText = 'Get started';

      return '<div class="gc-consent-title">' + title + '</div><div class="gc-consent-points"><ul><li>'+points[0]+'</li><li>' + points[1] + '</li><li>' + points[2] + '</li></ul></div><div class="gc-cta"> <a class="gc-button btn-primary" href="">' + ctaText + '</a></div><div class="gc-terms"> If you click "Get started", we will transmit your email address to Good&Co and a Good&Co account will be created with that email address, or you will be logged in to your existing Good&Co account if you have used the same email address, which will then be linked to your Totaljobs account. If you return to this page after creating or linking an account, Good&Co will automatically log you in based on an identifier transmitted by us.<p>The Good&Co <a href="https://good.co/terms-conditions/" target="_blank">terms & conditions</a> and the <a href="https://good.co/privacy-policy/" target="_blank">privacy policy</a> apply. On completion of the survey, Good&Co will set up a psychometric report viewable by recruiters of Totaljobs and its partner brands.</p></div>';
    }

    function getReportButtonLoadingState() {
      return '<div class="gc-final-report-loading">Loading</div>';
    }

    function getReportButtonDownloadState() {
      const ctaText = 'Download';

      return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" viewBox="0 0 20 18"><path fill="#FFF" fill-rule="nonzero" d="M17.273 18H2.727C1.182 18 0 16.844 0 15.333V10.89C0 10.356.364 10 .91 10c.545 0 .908.356.908.889v4.444c0 .534.364.89.91.89h14.545c.545 0 .909-.356.909-.89V10.89c0-.533.363-.889.909-.889.545 0 .909.356.909.889v4.444C20 16.844 18.818 18 17.273 18zm-7.133-5.07c.18.093.45.093.72 0 .09-.093.18-.093.27-.186l3.6-3.72a.92.92 0 0 0 0-1.303.85.85 0 0 0-1.26 0L11.4 9.86V.93c0-.559-.36-.931-.9-.931s-.9.372-.9.93v8.93L7.53 7.72a.85.85 0 0 0-1.26 0c-.18.187-.27.466-.27.652s.09.465.27.651l3.6 3.721c.09.093.18.186.27.186z"/></svg>'+ ctaText;
    }

    function getFinalInlineScreenTemplate() {
      const title = state.firstQuizPassedInCurrentSession ? 'Thanks for taking our quiz!' : 'Your culture fitscores are now available!';
      const description = 'Your search results will now show <b>fitscores</b> if roles match your top personality traits';
      const ctaDescription = 'Download your custom <b>personality guide</b> to learn more about your <b>strengths</b>';

      return '<div class="gc-final-title">'+ title +'</div><div class="gc-final-description">'+ description +'</div><div class="gc-final-background"><div class="gc-final-background-dots"></div></div><div><button type="button" class="gc-final-button">'+getReportButtonDownloadState()+'</button><div class="gc-final-button-description">'+ ctaDescription +'</div></div><div class="gc-final-powered-by"><img src="https://good.co/images/tealium/powered-by-logo.png"/></div>';
    }

    function getFitscoreModalTemplate(strengthWords, quizzesPassed) {
      var strengthWordContent = strengthWords.map(function(strengthWord) { return '<span class="gc-strengthword">'+strengthWord+'</span>'; }).join('');

      var progress = {};
      switch (quizzesPassed) {
        case 1:
          progress = {
            title: 'Just an extra <b>3 minutes</b> to increase your accuracy!',
            progressImage: 'https://good.co/images/tealium/progress-1.png',
            showCta: true
          };
          break;
        case 2:
          progress = {
            title: 'Just an extra <b>3 minutes</b> to increase your accuracy!',
            progressImage: 'https://good.co/images/tealium/progress-2.png',
            showCta: true
          };
          break;
        case 3:
          progress = {
            title: 'Your profile accuracy is <b>medium</b>, nearly there!',
            progressImage: 'https://good.co/images/tealium/progress-3.png',
            showCta: true
          };
          break;
        case 4:
          progress = {
            title: 'Your profile accuracy is <b>medium</b>, nearly there!',
            progressImage: 'https://good.co/images/tealium/progress-4.png',
            showCta: true
          };
          break;
        case 5:
          progress = {
            title: 'Nice work! Your profile accuracy is <b>high</b>',
            progressImage: 'https://good.co/images/tealium/progress-5.png',
            showCta: false
          };
          break;
      }
      var cta = progress.showCta ? '<button type="button" class="gc-button btn-primary">Improve Accuracy</button>' : '';

      return '<div class="gc-fitscore-modal"><button type="button" class="gc-close"><span class="gc-top-bar"></span><span class="gc-bottom-bar"></span></button><div class="gc-title">Culture FitScore</div><div class="gc-description">Good&Co’s Culture FitScore calculates how your top strengths and traits compare to high performers in this role.</div><div><div class="gc-strengthcard-title">You’re a top fit for the following strengths</div><div>'+strengthWordContent+'</div></div><div class="gc-divider"></div><div class="gc-quiz-description">'+ progress.title +'</div><div class="gc-quiz-progress-wrapper"><img class="gc-progress-img" src="'+ progress.progressImage +'" /></div>' + cta + '<div class="gc-powered-by"><span>Powered By</span> <a target="_blank" href="https://good.co">www.good.co</a></div></div>';
    }
  }
}());
