rasa test nlu --config chatbot/configs/bag_of_word.yml \
              --cross-validation --runs 1 --folds 2 \
              --out gridresults/config-light
rasa test nlu --config chatbot/configs/bert.yml \
              --cross-validation --runs 1 --folds 2 \
              --out gridresults/config-bert
rasa test nlu --config chatbot/configs/roberta.yml \
              --cross-validation --runs 1 --folds 2 \
              --out gridresults/config-roberta