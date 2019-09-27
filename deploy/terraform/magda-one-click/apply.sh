wget -q https://magda-files.s3-ap-southeast-2.amazonaws.com/magda_trial_cert/cert_status.json -O ./cert_status.json
export TF_VAR_timestamp=`date +%s`
terraform apply
