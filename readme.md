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
