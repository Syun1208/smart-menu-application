export PORT=1208
rasa run --enable-api --cors * -m ./models/20230609-151105-selfish-heap.tar.gz -vv --log-file out.log -p ${PORT}