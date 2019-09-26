provider "google-beta" {
  version     = ">= 2.11.0"
  project     = var.project
  region      = var.region
  credentials = "${var.credential_file_path}"
}

provider "google" {
  version     = ">= 2.11.0"
  project     = var.project
  region      = var.region
  credentials = "${var.credential_file_path}"
}

locals {
  cluster_access_toekn          = "${data.google_client_config.default.access_token}"
  cluster_access_host           = "https://${module.cluster.endpoint}"
  cluster_access_ca_certificate = "${base64decode(module.cluster.master_auth.0.cluster_ca_certificate)}"
}

terraform {
  # The modules used in this example have been updated with 0.12 syntax, which means the example is no longer
  # compatible with any versions below 0.12.
  required_version = ">= 0.12"
}

data "google_client_config" "default" {}

provider "kubernetes" {
  # We use the oauth2 token of the google provider client
  # and get cluster parameter from module
  # this will ensure right live parameter in place
  # avoid using google_container_cluster as it might be difficult to control triming at both `refresh` & `apply` stage
  load_config_file = false

  host                   = local.cluster_access_host
  token                  = local.cluster_access_toekn
  cluster_ca_certificate = local.cluster_access_ca_certificate
}

provider "helm" {
  kubernetes {
    load_config_file = false

    host                   = local.cluster_access_host
    token                  = local.cluster_access_toekn
    cluster_ca_certificate = local.cluster_access_ca_certificate
  }
}

module "external_ip" {
  source = "../google-reserved-ip"
}

module "cluster" {
  source  = "../google-cluster"
  project = var.project
  region  = var.region
}

resource "kubernetes_cluster_role_binding" "default_service_acc_role_binding" {
  metadata {
    name = "default-service-acc-role-binding"
  }
  role_ref {
    kind      = "ClusterRole"
    name      = "cluster-admin"
    api_group = "rbac.authorization.k8s.io"
  }
  subject {
    kind      = "ServiceAccount"
    name      = "default"
    namespace = "kube-system"
  }

  depends_on = [
    module.cluster
  ]
}

resource "kubernetes_namespace" "magda_namespace" {
  metadata {
    name = "${var.namespace}"
  }
  depends_on = [
    kubernetes_cluster_role_binding.default_service_acc_role_binding
  ]
}

resource "helm_release" "magda_helm_release" {
  name = "magda"
  # or repository = "../../helm" for local repo
  repository = "https://charts.magda.io/"
  chart      = "magda"
  timeout    = 1800

  namespace = "${var.namespace}"

  values = [
    "${file("../../helm/magda-one-click.yml")}"
  ]

  set {
    name  = "externalUrl"
    value = "http://${module.external_ip.address}.xip.io/"
  }

  depends_on = [
    kubernetes_cluster_role_binding.default_service_acc_role_binding
  ]
}

resource "google_compute_managed_ssl_certificate" "default" {
  provider = "google-beta"

  name = "magda-certificate"

  managed {
    domains = ["${module.external_ip.address}.xip.io"]
  }

  depends_on = [
    helm_release.magda_helm_release
  ]
}

resource "kubernetes_ingress" "default" {
  metadata {
    name      = "magda-primary-ingress"
    namespace = "${var.namespace}"
    annotations = {
      "ingress.gcp.kubernetes.io/pre-shared-cert"   = google_compute_managed_ssl_certificate.default.name
      "kubernetes.io/ingress.global-static-ip-name" = module.external_ip.name
    }
  }

  spec {
    backend {
      service_name = "gateway"
      service_port = 80
    }
  }

  depends_on = [
    helm_release.magda_helm_release
  ]
}


