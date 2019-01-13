
rm code.zip
zip -r code.zip node_modules *.js
FUNCTION_NAME=azeembaSyncToS3 
aws --profile lambda lambda update-function-code --publish --function-name $FUNCTION_NAME --zip-file fileb://code.zip
