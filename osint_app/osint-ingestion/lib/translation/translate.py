#!/usr/bin/env python3
"""
Translation service using argostranslate
Supports language detection and translation to English
"""

import json
import sys
import argostranslate.package
import argostranslate.translate
from langdetect import detect, LangDetectException
import logging

# Set up logging
logging.basicConfig(level=logging.ERROR)

# Initialize argostranslate
def initialize_argostranslate():
    """Download and install translation packages if needed"""
    argostranslate.package.update_package_index()
    available_packages = argostranslate.package.get_available_packages()
    
    # Languages we want to support
    target_langs = ['es', 'fr', 'de', 'ru', 'ar', 'zh', 'ja', 'ko', 'pt', 'it']
    
    for lang in target_langs:
        # Find package for translating from this language to English
        package = next(
            (pkg for pkg in available_packages 
             if pkg.from_code == lang and pkg.to_code == 'en'),
            None
        )
        if package and not package.installed:
            argostranslate.package.install_from_path(package.download())

def detect_language(text):
    """Detect the language of the text"""
    try:
        # Use langdetect for initial detection
        lang = detect(text)
        
        # Map langdetect codes to argostranslate codes
        lang_map = {
            'en': 'en',
            'es': 'es',
            'fr': 'fr',
            'de': 'de',
            'ru': 'ru',
            'ar': 'ar',
            'zh-cn': 'zh',
            'zh-tw': 'zh',
            'ja': 'ja',
            'ko': 'ko',
            'pt': 'pt',
            'it': 'it'
        }
        
        return lang_map.get(lang, lang)
    except LangDetectException:
        return 'en'  # Default to English if detection fails

def translate_to_english(text, source_lang):
    """Translate text to English"""
    if source_lang == 'en':
        return text, False
    
    try:
        # Get translation
        translated = argostranslate.translate.translate(text, source_lang, 'en')
        return translated, True
    except Exception as e:
        logging.error(f"Translation error: {e}")
        return text, False

def detect_and_translate(text):
    """Main function to detect language and translate if needed"""
    # Detect language
    source_lang = detect_language(text)
    
    # Translate if not English
    translated_text, was_translated = translate_to_english(text, source_lang)
    
    return {
        'original_text': text,
        'translated_text': translated_text,
        'original_language': source_lang,
        'translated': was_translated
    }

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: translate.py <command> <text>'}))
        sys.exit(1)
    
    command = sys.argv[1]
    text = sys.argv[2]
    
    # Initialize on first run
    initialize_argostranslate()
    
    if command == 'detect_and_translate':
        result = detect_and_translate(text)
        print(json.dumps(result))
    elif command == 'detect':
        lang = detect_language(text)
        print(json.dumps({'language': lang}))
    elif command == 'translate':
        if len(sys.argv) < 4:
            print(json.dumps({'error': 'Usage: translate.py translate <source_lang> <text>'}))
            sys.exit(1)
        source_lang = sys.argv[2]
        text = sys.argv[3]
        translated, success = translate_to_english(text, source_lang)
        print(json.dumps({
            'translated_text': translated,
            'success': success
        }))
    else:
        print(json.dumps({'error': f'Unknown command: {command}'}))
        sys.exit(1)

if __name__ == '__main__':
    main()