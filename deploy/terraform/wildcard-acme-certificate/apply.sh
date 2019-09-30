#!/bin/bash
terraform init
DOMAIN_COMMON_NAME = "*.${TF_VAR_domain_root}"
STATUS_FILE_URL = "https://${TF_VAR_cert_s3_bucket}.s3-${TF_VAR_aws_default_region}.amazonaws.com/${TF_VAR_cert_s3_folder}/cert_status.json"
SHOULD_APPLY = `../../../scripts/is-cert-expired.js --status-file-url=${STATUS_FILE_URL} --domain=${DOMAIN_COMMON_NAME} --expiry-days=${TF_VAR_cert_min_days_remaining}`
echo $DOMAIN_COMMON_NAME
echo $STATUS_FILE_URL
echo $SHOULD_APPLY
if [ "${SHOULD_APPLY}" = "false" ]; then
    exit
fi
terraform apply -auto-approve