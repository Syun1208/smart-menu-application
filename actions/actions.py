# This files contains your custom actions which can be used to run
# custom Python code.
#
# See this guide on how to implement these action:
# https://rasa.com/docs/rasa/custom-actions


# This is a simple example for a custom action which utters "Hello World!"

from typing import Any, Text, Dict, List

from rasa_sdk import Action, Tracker, FormValidationAction
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.types import DomainDict
from rasa_sdk.events import SlotSet
from rasa_sdk.forms import FormAction
from datetime import datetime
from datetime import date
from zoneinfo import ZoneInfo
import calendar
import random
import requests

class ActionAskDate(Action):
    def name(self) -> Text:
        return "action_ask_date"
    
    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker,  domain: DomainDict) -> Dict[Text, Text]:
        return [SlotSet('date_answer', date.today())]

class ActionAskTime(Action):
    def name(self) -> Text:
        return "action_ask_time"
    
    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker,  domain: DomainDict) -> Dict[Text, Text]:
        now = datetime.now(tz=ZoneInfo("Asia/Ho_Chi_Minh"))

        current_time = now.strftime("%H:%M:%S")
        
        return [SlotSet('time_answer', current_time)]

# class ActionAskFirstName(Action):
#     def name(self) -> Text:
#         return "action_ask_first_name"
    
#     def run(self, dispatcher: CollectingDispatcher, tracker: Tracker,  domain: DomainDict) -> Dict[Text, Text]:
#         return {'first_name': ''}

# class ActionAskLastName(Action):
#     def name(self) -> Text:
#         return "action_ask_last_name"
    

#     def run(self, dispatcher: CollectingDispatcher, tracker: Tracker,  domain: DomainDict) -> Dict[Text, Text]:
#         return {'last_name': ''}