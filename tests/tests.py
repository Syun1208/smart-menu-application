from rasa_nlu.training_data import load_data
from rasa_nlu.model import Trainer
from rasa_nlu import config


def test_nlu_interpreter():
    training_data = load_data("data/nlu_converted.yml")
    trainer = Trainer(config.load("../config.yml"))
    interpreter = trainer.train(training_data)
    test_interpreter_dir = trainer.persist(
        "./tests/models", project_name="nlu")
    parsing = interpreter.parse('xin chào')
    print(parsing)

    assert parsing['intent']['name'] == 'greeting'
    assert test_interpreter_dir

test_nlu_interpreter()