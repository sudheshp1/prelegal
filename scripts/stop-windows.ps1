# Stops and removes the Prelegal container, discarding its database.

if (docker ps -aq --filter "name=^prelegal$") {
    docker rm -f prelegal | Out-Null
    Write-Host "Prelegal stopped."
} else {
    Write-Host "Prelegal is not running."
}
