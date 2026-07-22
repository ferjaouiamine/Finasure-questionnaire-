"""Importe les questions et réponses exactes du classeur ERM vers questionnaire-data.js."""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "Questionnaire_Maturite_ERM(1).xlsx"
TARGET = ROOT / "js" / "questionnaire-data.js"
SHEET_NAME = "1. Questionnaire"
MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"m": MAIN, "r": REL}
DIMENSION_IDS = {
    1: "strategie",
    2: "gouvernance",
    3: "culture",
    4: "identification",
    5: "analyse",
    6: "traitement",
    7: "revue",
    8: "reporting",
    9: "continuite",
    10: "crise",
    11: "resilience",
}
LEVEL_NAMES = ["Émergent", "En progression", "Établi", "Avancé", "Aspirationnel"]


def column_number(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference)
    if not letters:
        raise ValueError(f"Référence de cellule invalide : {reference}")
    number = 0
    for letter in letters.group():
        number = number * 26 + ord(letter) - 64
    return number


def read_sheet_rows() -> list[dict[int, str]]:
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Classeur absent : {SOURCE}")

    with zipfile.ZipFile(SOURCE) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = [
                "".join(node.text or "" for node in item.iter(f"{{{MAIN}}}t"))
                for item in shared_root.findall("m:si", NS)
            ]

        sheet_target = None
        for sheet in workbook.find("m:sheets", NS):
            if sheet.attrib["name"] == SHEET_NAME:
                relationship_id = sheet.attrib[f"{{{REL}}}id"]
                sheet_target = targets[relationship_id].lstrip("/")
                break
        if not sheet_target:
            raise ValueError(f"Feuille absente : {SHEET_NAME}")
        if not sheet_target.startswith("xl/"):
            sheet_target = "xl/" + sheet_target

        sheet_root = ET.fromstring(archive.read(sheet_target))
        rows: list[dict[int, str]] = []
        for row in sheet_root.findall(".//m:sheetData/m:row", NS):
            values: dict[int, str] = {}
            for cell in row.findall("m:c", NS):
                index = column_number(cell.attrib["r"])
                cell_type = cell.attrib.get("t")
                value_node = cell.find("m:v", NS)
                if cell_type == "inlineStr":
                    value = "".join(node.text or "" for node in cell.iter(f"{{{MAIN}}}t"))
                elif value_node is None:
                    value = ""
                elif cell_type == "s":
                    value = shared_strings[int(value_node.text)]
                else:
                    value = value_node.text or ""
                values[index] = value.strip() if isinstance(value, str) else ""
            rows.append(values)
        return rows


def extract_questions(rows: list[dict[int, str]]) -> list[dict[str, object]]:
    questions: list[dict[str, object]] = []
    current_dimension = ""
    for row in rows:
        if row.get(1):
            current_dimension = row[1]
        question = row.get(3, "")
        choices = [row.get(column, "") for column in range(4, 9)]
        if not question or question == "Question" or not any(choices):
            continue
        dimension_match = re.match(r"\s*(\d+)", current_dimension)
        if not dimension_match:
            raise ValueError(f"Dimension introuvable pour la question : {question}")
        dimension_number = int(dimension_match.group(1))
        answers = [
            {
                "code": chr(65 + index),
                "name": LEVEL_NAMES[index],
                "score": index + 1,
                "description": description,
            }
            for index, description in enumerate(choices)
        ]
        questions.append(
            {
                "id": len(questions) + 1,
                "dimensionId": DIMENSION_IDS[dimension_number],
                "text": question,
                "answers": answers,
            }
        )
    return questions


def validate(questions: list[dict[str, object]]) -> None:
    if len(questions) != 33:
        raise ValueError(f"33 questions attendues, {len(questions)} trouvées")
    for question in questions:
        answers = question["answers"]
        descriptions = [answer["description"] for answer in answers]
        scores = [answer["score"] for answer in answers]
        if len(answers) != 5 or any(not description for description in descriptions):
            raise ValueError(f"Question {question['id']} : cinq réponses non vides requises")
        if len(set(descriptions)) != 5:
            raise ValueError(f"Question {question['id']} : réponses dupliquées")
        if scores != [1, 2, 3, 4, 5]:
            raise ValueError(f"Question {question['id']} : scores invalides")


def write_javascript(questions: list[dict[str, object]]) -> None:
    source = TARGET.read_text(encoding="utf-8")
    start = source.find("/* Questions et réponses exactes importées depuis")
    if start < 0:
        start = source.find("const questions=")
    end = source.find("window.FINASURE_ERM_DATA", start)
    if start < 0 or end < 0:
        raise ValueError("Bloc de données à remplacer introuvable")
    payload = json.dumps(questions, ensure_ascii=False, separators=(",", ":"))
    replacement = (
        "/* Questions et réponses exactes importées depuis "
        "data/Questionnaire_Maturite_ERM(1).xlsx, colonnes C à H. */\n"
        f"const questions={payload};\n"
    )
    TARGET.write_text(source[:start] + replacement + source[end:], encoding="utf-8")


def main() -> int:
    questions = extract_questions(read_sheet_rows())
    validate(questions)
    write_javascript(questions)
    print(f"Import terminé : {len(questions)} questions, {len(questions) * 5} réponses exactes.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Erreur d’import : {error}", file=sys.stderr)
        raise
