"""
Test kết nối Google Sheets API và BigQuery
Chạy: python scripts/test_connection.py
"""

import json
import sys
from pathlib import Path

CREDS_PATH = Path(__file__).parent.parent / 'credentials' / 'service-account.json'
SPREADSHEET_ID = '1F7Fn6EC2yimTKV_aWAzzJZmF7Kfv9sfSca7hgCKZuEk'
BQ_PROJECT = 'trioderma-analytics'
BQ_DATASET = 'tiktok_shop_data'
BQ_TABLE   = 'orders_raw'


def test_sheets():
    print('\n── Google Sheets API ─────────────────────')
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds = service_account.Credentials.from_service_account_file(
            str(CREDS_PATH),
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
        )
        service = build('sheets', 'v4', credentials=creds)
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='Orders!A1:A2'
        ).execute()
        print('✅ Kết nối OK —', result.get('values', []))
    except FileNotFoundError:
        print('❌ Không tìm thấy credentials/service-account.json')
    except Exception as e:
        print(f'❌ Lỗi: {e}')


def test_bigquery():
    print('\n── BigQuery ──────────────────────────────')
    try:
        from google.oauth2 import service_account
        from google.cloud import bigquery

        creds = service_account.Credentials.from_service_account_file(
            str(CREDS_PATH),
            scopes=['https://www.googleapis.com/auth/bigquery.readonly']
        )
        client = bigquery.Client(project=BQ_PROJECT, credentials=creds)
        query = f'SELECT COUNT(*) as total FROM `{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE}`'
        result = list(client.query(query).result())
        print(f'✅ Kết nối OK — Tổng rows: {result[0].total:,}')
    except FileNotFoundError:
        print('❌ Không tìm thấy credentials/service-account.json')
    except Exception as e:
        print(f'❌ Lỗi: {e}')


if __name__ == '__main__':
    if not CREDS_PATH.exists():
        print(f'⚠️  Thiếu file: {CREDS_PATH}')
        print('   Xem hướng dẫn trong credentials/README.md')
        sys.exit(1)
    test_sheets()
    test_bigquery()
    print()
