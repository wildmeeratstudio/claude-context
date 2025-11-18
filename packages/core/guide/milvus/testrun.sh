export CLUSTER_ENDPOINT="http://172.21.130.106:19530"
export TOKEN="root:Milvus"
# curl --request POST \
# --url "${CLUSTER_ENDPOINT}/v2/vectordb/databases/create" \
# --header "Authorization: Bearer ${TOKEN}" \
# --header "Content-Type: application/json" \
# -d '{
#     "dbName": "my_database_1"
# }'



curl --request POST \
--url "${CLUSTER_ENDPOINT}/v2/vectordb/databases/describe" \
--header "Authorization: Bearer ${TOKEN}" \
--header "Content-Type: application/json" \
-d '{
    "dbName": "default"
}'