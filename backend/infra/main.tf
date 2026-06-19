# Reproducible infrastructure for the OSHI Arena signup API.
#
# This provisions: required APIs, a Firestore (native) database, an Artifact
# Registry repo, a least-privilege runtime service account, and a public
# Cloud Run service.
#
# The container image must be built and pushed BEFORE `terraform apply`, e.g.:
#   gcloud builds submit ../  --tag \
#     REGION-docker.pkg.dev/PROJECT/oshi-arena/oshi-arena-api:latest
# then pass that tag via -var="image=...".
#
# For a faster path without Terraform, use ../deploy.sh.

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  apis = [
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "firestore.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each           = toset(local.apis)
  service            = each.value
  disable_on_destroy = false
}

resource "google_firestore_database" "default" {
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"
  depends_on  = [google_project_service.apis]
}

resource "google_artifact_registry_repository" "repo" {
  repository_id = "oshi-arena"
  format        = "DOCKER"
  location      = var.region
  depends_on    = [google_project_service.apis]
}

resource "google_service_account" "api" {
  account_id   = "oshi-arena-api"
  display_name = "OSHI Arena signup API (Cloud Run runtime)"
}

# Least privilege: the runtime SA can read/write Firestore, nothing else.
resource "google_project_iam_member" "firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_cloud_run_v2_service" "api" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.api.email

    containers {
      image = var.image
      ports {
        container_port = 8080
      }
      env {
        name  = "ALLOWED_ORIGINS"
        value = join(",", var.allowed_origins)
      }
      env {
        name  = "FIRESTORE_COLLECTION"
        value = "signups"
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 4
    }
  }

  depends_on = [google_project_iam_member.firestore]
}

# Public endpoint (the browser calls it directly; CORS restricts origins).
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
