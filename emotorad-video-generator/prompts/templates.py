"""Basic prompt template utilities"""
from typing import List, Dict

class PromptTemplates:
    @staticmethod
    def build_founder_section(founders: List[str], founder_data: Dict) -> str:
        if not founders:
            return ""
        desc = []
        for name in founders:
            info = founder_data.get(name, "")
            if info:
                desc.append(f"- {name}: {info}")
            else:
                desc.append(f"- {name}")
        return "Founders Present:\n" + "\n".join(desc)

    @staticmethod
    def build_visual_elements(elements: List[str]) -> str:
        return "\n".join([f"- {e}" for e in elements])
