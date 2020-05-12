#! usr/bin/env/python

import boto3
from bs4 import BeautifulSoup
from urllib import request


class JobSite(object):
    def get_jobs(self):
        """
       method that
           - requests html from child class url
           - uses BS4 and html.parser to parse response
           - seperates the above into a list of jobs by class div
           - extracts detail from jobs and returns list of values
       :return a list of job dicts in DynamoDB format
       """
        try:
            print(f"getting jobs from: {self.url}")
            r = request.urlopen(self.url, timeout=12)
            soup = BeautifulSoup(r, "html.parser")
            jobs = soup.find_all(class_=f"{self.job_block}")
            extracted_jobs = self.__extract_job_details(jobs)
        except Exception as err:
            print(f"ERROR: {self.name} did not download: {err}")
        finally:
            if len(extracted_jobs) == 0:
                raise Exception("Content donwloaded but no jobs parsed")

        return extracted_jobs

    def __extract_job_details(self, jobs):
        """
       takes a list of parsed html then extacts jobs details.
       will write any failures to file for further analysis
       :params job as list of strs
       :return
       """
        extracted_jobs = []
        for job in jobs:
            try:
                extracted = self.get_details(job)
                extracted_jobs.append(extracted)
            except Exception as err:
                with open("./error_log.txt", "a") as file:
                    file.write("\n ------------Break------------ \n")
                    file.write(str(job))
        return extracted_jobs

    @classmethod
    def insert_into_db(cls, jobs):
        """
       inserts jobs to aws dynamodb
       """
        dynamodb = boto3.client("dynamodb")
        table_name = "js.jobs_raw"
        condition = "attribute_not_exists(id)"
        for job in jobs:
            try:
                dynamodb.put_item(TableName=table_name, Item=job,
                ConditionExpression=condition)
            except Exception as e:
                # id exists, dont update
                continue
