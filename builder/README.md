# Containerized Build and Automated Deployment Environments For Knowledge Network - MAGDA

Requires a .env file with contents like

SECRETSDIR=[directory of secrets]
GOOGLECLIENTSECRET=[google client secret token]
FACEBOOKCLIENTSECRET=[facebook client secret token]
AAFCLIENTSECRET= [AAF client secret token]

where the secrets directory contains google kubenertes cluster authentication (see scripts) and the google facebook and aaf secrets are tokens for authenticating the KN app against these authentication providers
