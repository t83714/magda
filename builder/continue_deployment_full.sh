#!/bin/bash

echo ""
echo ""
echo "Getting Latest Version Of KN"
echo ""
echo ""

cd /app
git add .
git commit -m "commit for pull"
git pull
yarn install
lerna link

echo ""
echo ""
echo "Authenticating and Connecting to the Cluster"
echo ""
echo ""

gcloud auth activate-service-account kn-dev-robot@knowledge-network-192205.iam.gserviceaccount.com --key-file=/secrets/kn-dev-robot.json
gcloud container clusters get-credentials kn-dev-cluster-1 --zone australia-southeast1-a --project knowledge-network-192205
NAMESPACE=kn-v41-validation
TAG=$1
kubectl config set-context $(kubectl config current-context) --namespace=$NAMESPACE

echo ""
echo ""
echo "Upgrading Helm"
echo ""
echo ""

helm init --upgrade

echo ""
echo ""
echo "Destroying Existing Helm Deployment and Related Jobs and Secrets"
echo ""
echo ""

cd /app/deploy/helm && helm delete --timeout 600 --purge $NAMESPACE
kubectl delete job --all
kubectl delete statefulsets --all

echo ""
echo ""
echo "Building Select Components"
echo ""
echo ""

cd /app/magda-web-server && lerna run --loglevel=debug --scope=@magda/typescript-common --scope=@magda/web-admin --scope=@magda/web-server --scope=@magda/web-client --scope=@magda/kn-web-app* build
cd /app/magda-web-server && lerna run --loglevel=debug --scope=@magda/web-server docker-build-kn -- -- --tag gcr.io/knowledge-network-192205/data61/magda-web-server:$TAG
 
 
cd /app/magda-gateway && lerna run --loglevel=debug --scope=@magda/typescript-common --scope=@magda/gateway build
cd /app/magda-gateway && lerna run --loglevel=debug --scope=@magda/gateway docker-build-kn -- -- --tag gcr.io/knowledge-network-192205/data61/magda-gateway:$TAG
 
# dap connector will be merged to magda/data61, will not need to build locally by KN team
#cd /app/magda-dap-connector && lerna run --loglevel=debug --scope=@magda/typescript-common --scope=@magda/dap-connector build
#cd /app/magda-dap-connector && lerna run --loglevel=debug --scope=@magda/dap-connector docker-build-kn -- -- --tag #gcr.io/knowledge-network-192205/data61/magda-dap-connector:$TAG


echo ""
echo ""
echo "Pushing Built Images To Cluster"
echo ""
echo ""

gcloud auth configure-docker
gcloud docker -- push gcr.io/knowledge-network-192205/data61/magda-web-server:$TAG
gcloud docker -- push gcr.io/knowledge-network-192205/data61/magda-gateway:$TAG
#gcloud docker -- push gcr.io/knowledge-network-192205/data61/magda-dap-connector:$TAG

echo ""
echo ""
echo "Deploying Via Helm"
echo ""
echo ""
cd /app/deploy/helm && helm install --timeout 999999999 --name $NAMESPACE magda --set web-server.image.repository="gcr.io/knowledge-network-192205/data61" --set web-server.image.tag=$TAG --set gateway.image.repository="gcr.io/knowledge-network-192205/data61" --set gateway.image.tag=$TAG -f magda-dev-kn-v0.0.41.yml
