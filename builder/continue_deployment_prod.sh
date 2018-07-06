#!/bin/bash

NAMESPACE=$1
TAG=$2

GCLOUD_CLUSTER=kn-prod-cluster-1
GCLOUD_ZONE=australia-southeast1-b
GCLOUD_PROJECT=knowledge-network-prod
# Add GCOUD user to the project
GCLOUD_USER=kn-prod-robot
# Download the key, and put it at root directory of magda project
GCLOUD_KEY_FILE=kn-prod-robot.json

# update helm deploy config file following document at https://confluence.csiro.au/display/OFW/KN2+Magda+Prod+Deployment+on+Google+Kubernetes+Engine
HELM_CONFIG_FILE=magda-prod-kn-prod-v41.yml
# View the page above to learn how to apply and config Google OAuth
GOOGLE_CLIENT_SECRET='Vnw5fxIwXMOEpYpTvWggtzpc' 
FACEBOOK_CLIENT_SECRET='p4ssw0rd'
AAF_CLIENT_SECRET='[([2b&}JLjeq-*4d21"P]s8L^cM4Q-{|'
# Whether the gcloud namespace created or not
NAMESPACE_EXIST=false

################################################################################
## Config and prepare these environment params before execute this script     ##
################################################################################

gcloud auth activate-service-account $GCLOUD_USER@$GCLOUD_PROJECT.iam.gserviceaccount.com --key-file=$GCLOUD_KEY_FILE
gcloud container clusters get-credentials $GCLOUD_CLUSTER --zone $GCLOUD_ZONE --project $GCLOUD_PROJECT

kubectl config set-context $(kubectl config current-context) --namespace=$NAMESPACE
if kubectl get namespace|grep $NAMESPACE >/dev/null
then
    $NAMESPACE_EXIST=true
    cd /app && git add . && git commit -m "commit for pull" && git pull
else
    kubectl create namespace $NAMESPACE
fi

cd /app  && yarn install && lerna link
cd /app/magda-web-server && lerna run --loglevel=debug --scope=@magda/typescript-common --scope=@magda/web-admin --scope=@magda/web-server --scope=@magda/web-client --scope=@magda/kn-web-app* build
cd /app/magda-web-server && lerna run --loglevel=debug --scope=@magda/web-server docker-build-kn -- -- --tag gcr.io/$GCLOUD_PROJECT/data61/magda-web-server:$TAG
 
 
cd /app/magda-gateway && lerna run --loglevel=debug --scope=@magda/typescript-common --scope=@magda/gateway build
cd /app/magda-gateway && lerna run --loglevel=debug --scope=@magda/gateway docker-build-kn -- -- --tag gcr.io/$GCLOUD_PROJECT/data61/magda-gateway:$TAG
 
# dap connector will be merged to magda/data61, will not need to build locally by KN team
#cd /app/magda-dap-connector && lerna run --loglevel=debug --scope=@magda/typescript-common --scope=@magda/dap-connector build
#cd /app/magda-dap-connector && lerna run --loglevel=debug --scope=@magda/dap-connector docker-build-kn -- -- --tag #gcr.io/$GCLOUD_PROJECT/data61/magda-dap-connector:$TAG

gcloud auth configure-docker
gcloud docker -- push gcr.io/$GCLOUD_PROJECT/data61/magda-web-server:$TAG
gcloud docker -- push gcr.io/$GCLOUD_PROJECT/data61/magda-gateway:$TAG
gcloud docker -- push gcr.io/$GCLOUD_PROJECT/data61/magda-indexer:$TAG
#gcloud docker -- push gcr.io/$GCLOUD_PROJECT/data61/magda-dap-connector:$TAG

if [ $NAMESPACE_EXIST = true ]
then
    cd /app/deploy/helm && helm upgrade $NAMESPACE magda  --set web-server.image.repository="gcr.io/$GCLOUD_PROJECT/data61" --set web-server.image.tag=$TAG --set gateway.image.repository="gcr.io/$GCLOUD_PROJECT/data61" --set gateway.image.tag=$TAG  --set indexer.image.repository="gcr.io/$GCLOUD_PROJECT/data61" --set indexer.image.tag=$TAG  --set gateway.auth.aafClientUri='https://rapid.test.aaf.edu.au/jwt/authnrequest/research/jn_kJNxp0DebnxU282EA_A' -f $HELM_CONFIG_FILE
    #cd /app/deploy/helm && helm upgrade $NAMESPACE magda  --set gateway.auth.aafClientUri="https://rapid.test.aaf.edu.au/jwt/authnrequest/research/SwkZe45s_8mnS3jlvsyFyg"  -f $HELM_CONFIG_FILE
#cd /app/deploy/helm && helm upgrade $NAMESPACE magda --set global.externalUrl="https://knowledgenet.co"  -f $HELM_CONFIG_FILE
else 
    # Init helm
    kubectl create serviceaccount --namespace kube-system tiller
    kubectl create clusterrolebinding tiller-cluster-rule --clusterrole=cluster-admin --serviceaccount=kube-system:tiller
    # kubectl patch deploy --namespace kube-system tiller-deploy -p '{"spec":{"template":{"spec":{"serviceAccount":"tiller"}}}}'     
    helm init --service-account tiller --upgrade
    # Create db secret
    kubectl create secret generic db-passwords --from-literal=combined-db=p4ssw0rd --from-literal=authorization-db=p4ssw0rd --from-literal=discussions-db=p4ssw0rd --from-literal=session-db=p4ssw0rd --from-literal=registry-db=p4ssw0rd --from-literal=combined-db-client=p4ssw0rd --from-literal=authorization-db-client=p4ssw0rd --from-literal=discussions-db-client=p4ssw0rd --from-literal=session-db-client=p4ssw0rd --from-literal=registry-db-client=p4ssw0rd --from-literal=elasticsearch=p4ssw0rd
    # Create sessionsecret
    cd /app/deploy/helm && ./create-auth-secrets.sh
    # Create oAuth secret
    # For how to create aaf client uri and configure google oAuth, please reference the appendix
    kubectl create secret generic oauth-secrets --from-literal=google-client-secret=$GOOGLE_CLIENT_SECRET --from-literal=facebook-client-secret=$FACEBOOK_CLIENT_SECRET --from-literal=aaf-client-secret=$AAF_CLIENT_SECRET
    # Install using helm  https://rapid.test.aaf.edu.au/jwt/authnrequest/research/jn_kJNxp0DebnxU282EA_A
    cd /app/deploy/helm && helm install --timeout 999999999 --name $NAMESPACE magda  --set web-server.image.repository="gcr.io/$GCLOUD_PROJECT/data61" --set web-server.image.tag=$TAG --set gateway.image.repository="gcr.io/$GCLOUD_PROJECT/data61" --set gateway.image.tag=$TAG  --set indexer.image.repository="gcr.io/$GCLOUD_PROJECT/data61" --set indexer.image.tag=$TAG  --set gateway.auth.aafClientUri='https://rapid.test.aaf.edu.au/jwt/authnrequest/research/jn_kJNxp0DebnxU282EA_A' -f  $HELM_CONFIG_FILE

fi