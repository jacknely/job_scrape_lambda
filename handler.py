#!/usr/bin/env python

from jobsite_master import JobSite
from jobsites import Reed, Indeed, Cw

class JobSiteFactory():
    """ given a job_site class from jobsites.py
    this generates a subclass object of JobSite
    """
    def create_job_search(self, job_site):
      return globals()[job_site]()

def scrape(event, context):
    """ event handler - entry point for function.

    creates a JobSite object for each object in jobsites.py

    :param event trigger info
    :param context env detail
    :return json response
    """
    job_obj = JobSiteFactory()
    job_sites = ['Cw', 'Reed', 'Indeed',]

    for site in job_sites:
        try:
            jobsite = job_obj.create_job_search(site)
            jobs = jobsite.get_jobs()
            JobSite.insert_into_db(jobs)
            print(f"COMPLETE: scrape from {jobsite.name} successful")
        except:
            print(f"ERROR: scrape from {jobsite.name} unsuccessful")

    return {
        'message': "job scrape complete"
    }

if __name__ == "__main__":
    scrape("foo", "bar")
