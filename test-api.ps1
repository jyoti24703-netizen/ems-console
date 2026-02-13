# Test the modification request endpoint
$uri = "http://localhost:4000/api/tasks/TEST_TASK_ID/request-modification"
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer test-token"
}
$body = @{
    requestType = "edit"
    reason = "This is a test modification request with sufficient length"
} | ConvertTo-Json

Write-Host "Testing: POST $uri"
Write-Host "Headers: $($headers | ConvertTo-Json)"
Write-Host "Body: $body"
Write-Host "---"

try {
    $response = Invoke-WebRequest -Uri $uri -Method POST -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "Status Code: $($response.StatusCode)"
    Write-Host "Content: $($response.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    Write-Host "Content: $($_.Exception.Response | Select-Object -ExpandProperty Content)"
}
