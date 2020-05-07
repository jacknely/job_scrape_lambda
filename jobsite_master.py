import boto3
from bs4 import BeautifulSoup
from urllib import request

class JobSite(object):

   def get_jobs(self):
       try:
           print(f"getting jobs from: {self.url}")
           r = request.urlopen(self.url, timeout=12)
           soup = BeautifulSoup(r, "html.parser")
           jobs = soup.find_all(class_=f"{self.job_block}")
           extracted_jobs = self.extract_job_details(jobs)
           return extracted_jobs
       except Exception as err:
           print(f"ERROR: {self.name} did not download: {err}")

   def extract_job_details(self, jobs):
       extracted_jobs = []
       for job in jobs:
          try:
              extracted = self.get_details(job)
              extracted_jobs.append(extracted)
          except Exception as err:
              with open("./error_log.txt", 'a') as file:
                 file.write("\n ------------Break------------  \n")
                 file.write(str(job))
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
