import pytest
from pathlib import Path
import sys
from unittest.mock import patch
from datetime import date
import boto3
from moto import mock_dynamodb2
import os

# needs set as PYTHONPATH env unav
sys.path.insert(0, str(Path(__file__).parent) + "/../")

from jobsite_master import JobSite


class TestJobSiteMaster:
    def setup_method(self):
        self.test_jobsite = SampleSite()

    def test_get_job(self):
        with open(self.test_jobsite.url, "r") as f:
            test_html = f.read()

        with patch("jobsite_master.request.urlopen") as urlopen_mock:
            urlopen_mock.return_value = test_html
            mock_response = urlopen_mock
            test_jobs = self.test_jobsite.get_jobs()

        assert len(test_jobs) == 19

    def test_get_job_error(self):
        error_jobsite = ErrorSampleSite()
        with open(error_jobsite.url, "r") as f:
            test_html = f.read()

        with patch("jobsite_master.request.urlopen") as urlopen_mock:
            urlopen_mock.return_value = test_html
            mock_response = urlopen_mock
            with pytest.raises(Exception):
                assert  error_jobsite.get_jobs()

    @mock_dynamodb2
    def test_insert_into_db(self):
        os.environ["AWS_ACCESS_KEY_ID"] = "foo"
        os.environ["AWS_SECRET_ACCESS_KEY"] = "bar"
        os.environ["AWS_DEFAULT_REGION"] = "eu-west-1"
        table_name = "js.jobs_raw"
        dynamodb = boto3.resource("dynamodb", region_name="eu-west-1")

        # create a mock dynamodb table
        table = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[{"AttributeName": "id", "KeyType": "HASH"},],
            AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"},],
        )

        # create a mock job input
        sample_job = [
            {
                "id": {"S": "test234"},
                "title": {"S": "test234"},
                "location": {"S": "test234"},
                "salary": {"S": "test234"},
                "contract": {"S": "test234"},
                "company": {"S": "test234"},
                "age": {"S": "test234"},
                "link": {"S": "test234"},
                "date": {"S": "test234"},
                "agency": {"S": "CW Jobs"},
                "summary": {"S": "test234"},
                "interested": {"S": "TBC"},
                "reviewed": {"S": "N"},
                "email": {"S": "N"},
            }
        ]

        JobSite.insert_into_db(sample_job)

        table = dynamodb.Table(table_name)
        response = table.get_item(Key={"id": "test234"})
        if "Item" in response:
            item = response["Item"]

        assert "id" in item
        assert item["id"] == "test234"


class SampleSite(JobSite):
    """
    sample JobSite child for testing purposes.

    """

    name = "Test"
    url = str(Path(__file__).parent / "sample_data/sample.html")
    print(url)
    job_block = "job"

    def get_details(obj, job):
        detail = {
            "id": {"S": job.find("a")["href"][-8]},
            "title": {"S": job.find("h2").get_text()},
            "location": {
                "S": job.find(class_="location").find("span").get_text().strip()
            },
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

class ErrorSampleSite(JobSite):
    """
    sample JobSite child for testing purposes.

    """

    name = "Test"
    url = str(Path(__file__).parent / "sample_data/sample_error.html")
    print(url)
    job_block = "job"

    def get_details(obj, job):
        detail = {
            "id": {"S": job.find("a")["href"][-8]},
            "title": {"S": job.find("h2").get_text()},
            "location": {
                "S": job.find(class_="location").find("span").get_text().strip()
            },
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
