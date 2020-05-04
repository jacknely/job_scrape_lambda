from datetime import date
from urllib import request

import boto3

from bs4 import BeautifulSoup

class JobSite(object):
   def get_jobs(self):
       print(f"getting jobs from: {self.url}")
       r = request.urlopen(self.url)
       soup = BeautifulSoup(r, "html.parser")
       jobs = soup.find_all(class_=f"{self.job_block}")
       extracted_jobs = [self.extract_job_details(job) for job in jobs]

       return extracted_jobs

   @classmethod
   def insert_into_db(cls, jobs):
       """
       inserts jobs to aws dynamodb
       """
       dynamodb = boto3.client("dynamodb")
       table_name = "js.jobs_raw"
       condition = 'attribute_not_exists(js.jobs_raw.id)'
       for job in jobs:
           dynamodb.put_item(TableName=table_name,
                             Item=job)

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


"""
for b in button:
   print button_obj.create_button(b).get_jobs()
"""

if __name__ == "__main__":
    scrape("foo", "bar")
