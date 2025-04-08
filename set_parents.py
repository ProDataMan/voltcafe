
import os
import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

# Load PAT from environment
load_dotenv()
pat = os.getenv('ADO_PAT')

organization = 'ProDataMan'
project = 'VoltCafe'

# IDs from your CSV export (replace these with actual IDs from your CSV)
parent_child_mapping = {
    # Epic ID: User Story IDs
    771: [772, 777, 781, 785, 789, 792, 795],

    # User Story ID: Task IDs
    772: [773, 774, 775, 776],
    777: [778, 779, 780],
    781: [782, 783, 784],
    785: [786, 787, 788],
    789: [790, 791],
    792: [793, 794],
    795: [796, 797, 798]
}

auth = HTTPBasicAuth('', pat)
headers = {'Content-Type': 'application/json-patch+json'}

def link_parent(child_id, parent_id):
    url = f'https://dev.azure.com/{organization}/{project}/_apis/wit/workitems/{child_id}?api-version=7.1-preview.3'
    data = [{
        'op': 'add',
        'path': '/relations/-',
        'value': {
            'rel': 'System.LinkTypes.Hierarchy-Reverse',
            'url': f'https://dev.azure.com/{organization}/{project}/_apis/wit/workitems/{parent_id}'
        }
    }]
    response = requests.patch(url, json=data, headers=headers, auth=auth)
    if response.status_code == 200:
        print(f'Successfully linked child {child_id} to parent {parent_id}.')
    else:
        print(f'Failed to link {child_id}: {response.status_code} {response.text}')

# Link User Stories to Epic and Tasks to User Stories
for parent_id, child_ids in parent_child_mapping.items():
    for child_id in child_ids:
        link_parent(child_id, parent_id)
