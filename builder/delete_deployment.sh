#!/bin/bash
echo ""
echo ""
echo "Destroying Existing Helm Deployment and Related Jobs and Secrets"
echo ""
echo ""

if helm ls | grep -q $NAMESPACE; then
    echo "Deleting $NAMESPACE"
    cd /app/deploy/helm && helm delete --timeout 600 --purge $NAMESPACE
    kubectl delete job --all
    kubectl delete statefulsets --all
    # Don't deleted kn-tls-secrets-v41 or default-token-*
    kubectl delete secrets auth-secrets oauth-secrets db-passwords  
else 
    echo "No running $NAMESPACE found"
fi
