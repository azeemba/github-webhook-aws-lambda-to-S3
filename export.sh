
rm code.zip
zip -r code.zip . -x *.zip
FUNCTION_NAME=azeembaSyncToS3 
aws --profile lambda lambda update-function-code --function-name $FUNCTION_NAME --zip-file fileb://code.zip
