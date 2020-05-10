![deploy lambda](https://github.com/jacknely/job_scrape_lambda/workflows/deploy-aws-lambda/badge.svg)
![Python app](https://github.com/jacknely/job_scrape_lambda/workflows/Python%20application/badge.svg)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)


# :office: Job Scraper: AWS Lambda Function
Python application that scrapes job adverts and uploads details to AWS DynamoDB

## Requirement
Install from requirements.txt:
- Python 3.6, 3.7, 3.8
- Beautiful Soup 4
- Requests
- Timeout Decorator

## Manual Deploy to Lambda
Ensure all required packages are install at root:
```
pip3 install requests bs4 -t .
```
Update application details in `serverless.yml`
Zip all files
```
zip -r package.zip *
```
Deploy to AWS:
```
serverless deploy
```
