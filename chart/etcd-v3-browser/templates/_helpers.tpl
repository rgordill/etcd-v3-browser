{{/*
Expand the name of the chart.
*/}}
{{- define "etcd-v3-browser.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "etcd-v3-browser.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "etcd-v3-browser.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "etcd-v3-browser.labels" -}}
helm.sh/chart: {{ include "etcd-v3-browser.chart" . }}
{{ include "etcd-v3-browser.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "etcd-v3-browser.selectorLabels" -}}
app.kubernetes.io/name: {{ include "etcd-v3-browser.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "etcd-v3-browser.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "etcd-v3-browser.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Console plugin name (must match plugin-manifest.json name field)
*/}}
{{- define "etcd-v3-browser.consolePluginName" -}}
{{- .Values.openshiftConsole.pluginName | default "etcd-v3-browser" }}
{{- end }}

{{/*
Console patcher resource name prefix
*/}}
{{- define "etcd-v3-browser.consolePatcherName" -}}
{{- printf "%s-console-patcher" (include "etcd-v3-browser.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
TLS secret name for the OpenShift serving certificate (console plugin HTTPS)
*/}}
{{- define "etcd-v3-browser.consolePluginTlsSecretName" -}}
{{- printf "%s-plugin-tls" (include "etcd-v3-browser.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}
