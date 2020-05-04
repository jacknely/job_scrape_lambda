from jobsite_master import JobSite
from jobsites import Reed, Indeed, Cw

class JobSiteFactory():
   def create_job_search(self, job_site):
      return globals()[job_site]()

def scrape(event, context):
    """
    event handler - entry point for function
    """
    job_obj = JobSiteFactory()
    job_sites = ['Cw', 'Reed', 'Indeed',]

    for site in job_sites:
        try:
            jobs = job_obj.create_job_search(site).get_jobs()
            JobSite.insert_into_db(jobs)
            print(f"COMPLETE: scrape from {site} successful")
        except:
            print(f"ERROR: scrape from {site} unsuccessful")

    return {
        'message': "job scrape complete"
    }

if __name__ == "__main__":
    scrape("foo", "bar")
