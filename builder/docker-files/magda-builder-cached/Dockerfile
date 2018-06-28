FROM csiroenvinf/magda-builder
RUN git clone -b kn/v0.0.41 https://github.com/CSIRO-enviro-informatics/magda.git app
WORKDIR app
RUN yarn install
RUN lerna link
RUN cd /app/magda-web-server && lerna run --loglevel=debug --scope=@magda/typescript-common --scope=@magda/web-admin --scope=@magda/web-server --scope=@magda/web-client --scope=@magda/kn-web-app* build
RUN cd /app/magda-gateway && lerna run --loglevel=debug --scope=@magda/typescript-common --scope=@magda/gateway build
