from datetime import date
from urllib import request

import boto3

from bs4 import BeautifulSoup


def parse_job_details(job):
    """
    parses a raw job to aws dynamodb format
    """
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


def download_jobs():
    """
    downloads raw jobs from jobsite
    """
    url = "https://www.reed.co.uk/jobs/junior-python-jobs-in-london?sortby=DisplayDate"
    print(f"getting jobs from: {url}")
    r = request.urlopen(url)
    soup = BeautifulSoup(r, "html.parser")
    filtered_soup = soup.find(class_="results col-xs-12 col-md-10")
    print(filtered_soup)
    jobs = filtered_soup.find_all(class_="job-result")
    extracted_jobs = [parse_job_details(job) for job in jobs]

    return extracted_jobs


def insert_to_db(jobs):
    """
    inserts jobs to aws dynamodb
    """
    dynamodb = boto3.client("dynamodb")
    table_name = "js.jobs_raw"
    condition = 'attribute_not_exists(js.jobs_raw.id)'
    for job in jobs:
        dynamodb.put_item(TableName=table_name, Item=job, ConditionExpression=condition)


def scrape(event, context):
    """
    event handler - entry point for function
    """
    print("Downloading jobs....")
    jobs = download_jobs()
    print("Adding jobs to database....")
    insert_to_db(jobs)
    return {
        'message': "Scrape from Jobsite complete"
    }


if __name__ == "__main__":
    print(download_jobs())
