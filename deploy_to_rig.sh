#!/bin/bash
# Liquid Galaxy Rig Deployment Script
# Usage: ./deploy_to_rig.sh <master_ip> <username> <password> <num_screens>

MASTER_IP=$1
USERNAME=$2
PASSWORD=$3
NUM_SCREENS=$4

if [ -z "$MASTER_IP" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: ./deploy_to_rig.sh <master_ip> <username> <password> <num_screens>"
  exit 1
fi

echo "Deploying to Liquid Galaxy Rig at $MASTER_IP with $NUM_SCREENS screens..."

# For each screen, connect via SSH to the master and execute chrome on the respective display.
for (( i=1; i<=$NUM_SCREENS; i++ ))
do
  # Using sshpass to bypass password prompt. Ensure sshpass is installed on the server.
  sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$USERNAME@$MASTER_IP" \
    "export DISPLAY=:0; google-chrome --kiosk 'http://localhost:8080/screen?screenId=$i' &"
done

echo "Deployment complete."
