#!/bin/bash
export TF_LOG= && terraform init 2>/dev/null
DOMAIN_COMMON_NAME="*.${TF_VAR_domain_root}"
STATUS_FILE_URL="https://${TF_VAR_cert_s3_bucket}.s3-${TF_VAR_aws_default_region}.amazonaws.com/${TF_VAR_cert_s3_folder}/cert_status.json"
SHOULD_APPLY=`../../../scripts/is-cert-expired.js --status-file-url=${STATUS_FILE_URL} --domain=${DOMAIN_COMMON_NAME} --expiry-days=${TF_VAR_cert_min_days_remaining}`
retVal=$?
if [ $retVal -ne 0 ]; then
    echo "Failed to check certificate expiry..."
    exit 1
fi
if [ "${SHOULD_APPLY}" = "true" ]; then
    rm -f ./terraform.tfstate
    export TF_LOG= && terraform apply -auto-approve 2>/dev/null
else 
    echo "No need to re-apply for a new wildcard certificate. Done!"
fi
