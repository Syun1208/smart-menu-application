apt-get update
apt-get install python3-dev python3-pip
venv ./venv
source ./venv/bin/activate
pip3 install -U pip
pip3 install rasa
pip3 install rasa[full]
pip3 install rasa[transformers]
pip install transformers
spacy download en_core_web_md