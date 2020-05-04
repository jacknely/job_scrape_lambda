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
   def insert_into_db(obj, jobs):
       """
       inserts jobs to aws dynamodb
       """
       dynamodb = boto3.client("dynamodb")
       table_name = "js.jobs_raw"
       condition = 'attribute_not_exists(js.jobs_raw.id)'
       for job in jobs:
           dynamodb.put_item(TableName=table_name,
                             Item=job,
                             ConditionExpression=condition)

class Reed(JobSite):
    url = "https://www.reed.co.uk/jobs/junior-python-jobs-in-london?sortby=DisplayDate"
    job_block = "job-result"
    def extract_job_details(obj, job):
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
    url = ""
    job_block = ""

    def extract_job_details(obj, job):
        detail = {}

        return detail

class Cw(JobSite):
    url = ""
    job_block = ""

    def extract_job_details(obj, job):
        detail = {}

        return detail


class JobSiteFactory():
   def create_job_search(self, job_site):
      return globals()[job_site]()

job_obj = JobSiteFactory()
button = ['Cw', 'Reed', 'Indeed']

jobs = job_obj.create_job_search('Reed').get_jobs()
JobSite.insert_into_db(jobs)

"""
for b in button:
   print button_obj.create_button(b).get_jobs()
"""
