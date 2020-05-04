from datetime import date
from jobsite_master import JobSite

class Reed(JobSite):
    url = "https://www.reed.co.uk/jobs/junior-python-jobs-in-london?sortby=DisplayDate"
    job_block = "job-result"
    def extract_job_details(self, job):
        detail = {
            "id": {"S": job.find(class_="job-result-anchor")['id']},
            "title": {"S": job.find('h3').get_text().strip()},
            "location": {"S": job.find(class_="location").get_text().strip()},
            "salary": {"S": job.find(class_="salary").get_text().strip()},
            "contract": {"S": job.find(class_="time").get_text().strip() if job.find(class_="time") else "null"},
            "company": {"S": job.find(class_="gtmJobListingPostedBy").get_text().strip()},
            "age": {"S": job.find(class_='posted-by').get_text().strip().split('by')[0]},
            "link": {"S": job.find('a')['href']},
            "date": {"S": date.today().strftime("%d/%m/%Y")},
            "agency": {"S": "Reed"},
            "summary": {"S": job.find(class_="description").get_text().strip()},
            "interested": {"S": "TBC"},
            "reviewed": {"S": "N"},
        }
        return detail

class Indeed(JobSite):
    url = "https://www.indeed.co.uk/jobs?q=Junior+Python&l=London&radius=10&start=0&limit=100"
    job_block = "jobsearch-SerpJobCard unifiedRow row result"

    def extract_job_details(obj, job):
        detail = {"id": {"S": job.find(class_="recJobLoc")['id'][10:]},
                  "title": {"S": job.find(class_="jobtitle turnstileLink").get_text().strip()},
                  "location": {"S": job.find(class_="location accessible-contrast-color-location").get_text().strip()},
                  "salary": {
                      "S": job.find(class_="salaryText").get_text().strip() if job.find(class_="salaryText") else "null"},
                  "contract": {"S": "null"},
                  "company": {"S": job.find(class_="company").get_text().strip()},
                  "age": {"S": job.find(class_="date").get_text().strip()},
                  "link": {"S": "https://www.indeed.co.uk" + job.find("a")["href"]},
                  "date": {"S": date.today().strftime("%d/%m/%Y")},
                  "agency": {"S": "Indeed"},
                  "summary": {"S": job.find(class_="summary").get_text().strip()},
                  "interested": {"S": "TBC"},
                  "reviewed": {"S": "N"},
                  }

        return detail

class Cw(JobSite):
    url = "http://www.cwjobs.co.uk/jobs/junior-python/in-london?radius=10&s=recentsearch&Sort=3"
    job_block = "job"

    def extract_job_details(obj, job):
        detail = {
            "id": {"S": job.find("a")["href"][-8:]},
            "title": {"S": job.find("h2").get_text()},
            "location": {"S": job.find(class_="location").find("span").get_text().strip()},
            "salary": {"S": job.find(class_="salary").get_text().replace("£", "")},
            "contract": {"S": job.find(title="employment type").get_text()},
            "company": {"S": job.find(title="hiring organization").get_text().strip()},
            "age": {"S": job.find(title="posted date").get_text().strip()},
            "link": {"S": job.find("a")["href"]},
            "date": {"S": date.today().strftime("%d/%m/%Y")},
            "agency": {"S": "CW Jobs"},
            "summary": {"S": job.find(class_="job-intro").get_text()},
            "interested": {"S": "TBC"},
            "reviewed": {"S": "N"},
        }

        return detail
