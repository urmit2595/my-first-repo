"""Utility to build prompts from templates"""
from typing import Dict
from config import Config
from prompts.motion_templates import MotionPromptTemplates
from prompts.templates import PromptTemplates

class PromptBuilder:
    @staticmethod
    def build_prompts(timeline_data: Dict, founder_data: Dict) -> Dict[int, str]:
        prompts = {}
        for scene in timeline_data["scenes"]:
            is_first = scene["scene_number"] == 1
            prompt = MotionPromptTemplates.create_motion_scene_prompt(
                scene=scene,
                brand=timeline_data["brand"],
                founder_data=founder_data,
                is_first_scene=is_first
            )
            prompts[scene["scene_number"]] = prompt
        return prompts
