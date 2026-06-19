output "api_url" {
  value       = google_cloud_run_v2_service.api.uri
  description = "Public URL of the signup API. Put this in index.html's oshi-api-base meta tag."
}

output "runtime_service_account" {
  value       = google_service_account.api.email
  description = "Least-privilege runtime service account for the Cloud Run service."
}
