FROM ubuntu

RUN apt-get update
RUN apt-get install -y software-properties-common curl sudo apt-transport-https ca-certificates 
RUN apt-get update
RUN curl -sL https://deb.nodesource.com/setup_6.x | sudo bash -
RUN echo "deb https://dl.bintray.com/sbt/debian /" | sudo tee -a /etc/apt/sources.list.d/sbt.list
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2EE0EA64E40A89B84B2DF73499E82A75642AC823
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
RUN add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

RUN apt-get update
RUN apt-get install -y nodejs openjdk-8-jdk docker-ce
RUN apt-get install -y sbt=0.13.16
RUN npm install -g lerna && npm install -g yarn

RUN export CLOUD_SDK_REPO="cloud-sdk-$(lsb_release -c -s)" && echo "deb http://packages.cloud.google.com/apt $CLOUD_SDK_REPO main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add - && apt-get update && apt-get install -y google-cloud-sdk kubectl
RUN apt-get install -y vim
RUN mkdir /app
RUN curl https://raw.githubusercontent.com/kubernetes/helm/master/scripts/get | bash
