{{/* vim: set filetype=mustache: */}}

{{- define "magda.registry-deployment" -}}
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: {{ .name }}
spec:
  replicas: {{ .deploymentConfig.replicas | default 1 }}
  strategy:
    rollingUpdate:
      maxUnavailable: {{ .root.Values.global.rollingUpdate.maxUnavailable | default 0 }}
  template:
    metadata:
      labels:
        service: {{ .name }}
    spec:
      containers:
      - name: {{ .name }}
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: jwt-secret
{{- if .root.Values.global.noDbAuth }}
        - name: POSTGRES_USER
          value: client
{{- else }}
        - name: POSTGRES_USER
          value: client
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-passwords
              key: registry-db-client
{{- end }}
        image: {{ template "dockerimage" .root }}
        imagePullPolicy: {{ .root.Values.image.pullPolicy | default .root.Values.global.image.pullPolicy }}
        command: [
            "/app/bin/magda-registry-api",
            "-Dhttp.port=80",
            "-Dhttp.externalUrl.v0={{ .root.Values.global.externalUrl }}/api/v0/registry",
            "-Ddb.default.url=jdbc:postgresql://registry-db/postgres",
            "-Dakka.loglevel={{ .root.Values.logLevel | default .root.Values.global.logLevel }}",
            "-DauthApi.baseUrl=http://authorization-api",
            "-Dscalikejdbc.global.loggingSQLAndTime.logLevel={{ .root.Values.global.logLevel | lower }}",
            "-Dauthorization.skip={{ .root.Values.skipAuthorization | default false }}",
            "-Drole={{ .role }}"
        ]
{{- if .root.Values.global.enableLivenessProbes }}
        livenessProbe:
          httpGet:
            path: "/v0/ping"
            port: 80
          initialDelaySeconds: 60
          periodSeconds: 10
          timeoutSeconds: {{ .root.Values.livenessProbe.timeoutSeconds | default 10 }}
{{- end }}
        ports:
        - containerPort: 80
        resources:
{{ .deploymentConfig.resources | default .root.Values.resources | toYaml | indent 10 }}
{{- end -}}