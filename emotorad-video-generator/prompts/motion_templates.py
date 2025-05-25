from typing import Dict, List, Optional

class MotionPromptTemplates:
    # Enhanced base style for motion and energy
    MOTION_BASE_STYLE = """
    Create a vibrant, miniaturized illustration optimized for dynamic video animation:
    
    Visual Style:
    - Emotorad brand colors: bright cyan (#00D4FF), energetic orange (#FF6B35), teal (#4ECDC4)
    - Miniaturized cartoon characters with exaggerated, expressive features
    - Modern, sporty e-bikes with sleek design and glowing tech elements
    - High energy composition with movement and life
    
    Motion Optimization:
    - Clear depth layers (background, midground, foreground) for parallax
    - Strategic empty space for camera movement
    - Motion blur and speed lines where appropriate
    - Particle effects and energy trails
    - Elements positioned for smooth transitions
    
    Technical Requirements:
    - High contrast for video compression
    - Clean edges for masking
    - Consistent lighting direction
    - No cropped important elements at edges
    """
    
    # Scene template with motion considerations
    MOTION_SCENE_TEMPLATE = """
    {base_style}
    
    Scene Context: {scene_title} ({year})
    Description: {description}
    
    Required Visual Elements:
    {visual_elements}
    
    Motion Direction: {motion_direction}
    Camera Movement: {camera_movement}
    
    Layer Composition:
    - Background: {background_layer}
    - Midground: {midground_layer}  
    - Foreground: {foreground_layer}
    - Overlay Effects: {overlay_layer}
    
    Energy Elements:
    {energy_elements}
    
    {founder_section}
    
    Text Space: Reserve clear space for "{text_overlay}" - positioned for {text_animation}
    
    Style: Vibrant Emotorad miniaturized style with high energy and movement potential.
    """
    
    # Enhanced reference template for consistency
    MOTION_REFERENCE_TEMPLATE = """
    {scene_prompt}
    
    CRITICAL CONSISTENCY REQUIREMENTS:
    This is scene {scene_number} of 9 in a cohesive video sequence.
    
    You MUST maintain from previous scenes:
    1. EXACT miniaturized character style and proportions
    2. IDENTICAL color palette (no variation in brand colors)
    3. SAME illustration technique, line weights, shading style
    4. CONSISTENT e-bike design language
    5. MATCHING energy level and visual vibrancy
    
    Motion Continuity:
    - Maintain consistent perspective for smooth transitions
    - Keep similar depth layer separation
    - Match particle effect style
    - Preserve lighting direction
    
    This should look like a single artist created all scenes as one cohesive animated video.
    """
    
    # Variation templates for creative options
    VARIATION_TEMPLATES = {
        "angle": "\n\nVariation: Different camera angle while maintaining all other elements identical.",
        "energy": "\n\nVariation: Amplify motion effects - more speed lines, particles, and dynamic blur.",
        "focus": "\n\nVariation: Shift focus between elements while keeping composition.",
        "lighting": "\n\nVariation: Alternative dramatic lighting for more cinematic feel."
    }
    
    @staticmethod
    def build_camera_movement_desc(camera_data: Dict) -> str:
        """Convert camera movement data to prompt text"""
        if not camera_data:
            return "Static shot"
        
        movement_type = camera_data.get("type", "static")
        descriptions = {
            "dolly_zoom": "Composed for dramatic dolly zoom effect",
            "orbit": "360-degree rotation ready composition", 
            "aerial_sweep": "Top-down view for sweeping camera movement",
            "drone_flythrough": "Depth-layered for fly-through animation",
            "push_in": "Central focus for dramatic push-in",
            "dramatic_push": "Hero composition for impact zoom",
            "whimsical_float": "Playful arrangement for floating camera",
            "crane_shot": "Wide establishing view for crane movement",
            "multi_angle_montage": "Multiple focal points for dynamic cuts"
        }
        
        return descriptions.get(movement_type, "Standard composition")
    
    @staticmethod
    def build_energy_elements(elements: List[str]) -> str:
        """Format energy and motion elements"""
        if not elements:
            return "Subtle motion elements"
        
        formatted = []
        for element in elements:
            if element == "spark_effects":
                formatted.append("Electric sparks and energy bursts")
            elif element == "floating_gears":
                formatted.append("Mechanical gears floating with rotation")
            elif element == "light_trails":
                formatted.append("Neon light trails showing movement")
            elif element == "particle_trail":
                formatted.append("Particle effects trailing moving objects")
            else:
                formatted.append(element)
        
        return "\n".join([f"- {e}" for e in formatted])
    
    @classmethod
    def create_motion_scene_prompt(
        cls,
        scene: Dict,
        brand: Dict,
        founder_data: Dict,
        is_first_scene: bool = True,
        variation_type: Optional[str] = None
    ) -> str:
        """Create a motion-optimized prompt for a scene"""
        
        # Extract layer data
        layers = scene.get("layer_composition", {})
        
        # Build the prompt sections
        from prompts.templates import PromptTemplates
        
        founder_section = PromptTemplates.build_founder_section(
            scene.get("founders_present", []),
            founder_data
        )
        
        visual_elements = PromptTemplates.build_visual_elements(
            scene["key_elements"]
        )
        
        energy_elements = cls.build_energy_elements(
            scene.get("energy_elements", [])
        )
        
        camera_desc = cls.build_camera_movement_desc(
            scene.get("camera_movement", {})
        )
        
        # Determine text animation style
        text_animation = "lower third with motion tracking" if "zoom" in scene.get("motion_direction", "") else "static overlay"
        
        # Create scene prompt
        scene_prompt = cls.MOTION_SCENE_TEMPLATE.format(
            base_style=cls.MOTION_BASE_STYLE,
            scene_title=scene["title"],
            year=scene["year"],
            description=scene["description"],
            visual_elements=visual_elements,
            motion_direction=scene.get("motion_direction", "static"),
            camera_movement=camera_desc,
            background_layer=layers.get("background", "simple gradient"),
            midground_layer=layers.get("midground", "main action"),
            foreground_layer=layers.get("foreground", "hero elements"),
            overlay_layer=layers.get("overlay", "effects and UI"),
            energy_elements=energy_elements,
            founder_section=founder_section,
            text_overlay=scene["text_overlay"],
            text_animation=text_animation
        )
        
        # Add reference for non-first scenes
        if not is_first_scene:
            scene_prompt = cls.MOTION_REFERENCE_TEMPLATE.format(
                scene_prompt=scene_prompt,
                scene_number=scene["scene_number"]
            )
        
        # Add variation if requested
        if variation_type and variation_type in cls.VARIATION_TEMPLATES:
            scene_prompt += cls.VARIATION_TEMPLATES[variation_type]
        
        return scene_prompt.strip()
    
    @staticmethod
    def create_motion_guide(scene: Dict) -> Dict:
        """Create a motion guide JSON for video editors"""
        return {
            "scene_number": scene["scene_number"],
            "duration_seconds": 5,
            "camera_movement": scene.get("camera_movement", {}),
            "motion_direction": scene.get("motion_direction", "static"),
            "energy_elements": scene.get("energy_elements", []),
            "transition_in": f"from_scene_{scene['scene_number']-1}" if scene["scene_number"] > 1 else "fade_in",
            "transition_out": f"to_scene_{scene['scene_number']+1}" if scene["scene_number"] < 9 else "fade_out",
            "text_animation": {
                "style": "slide_in_bottom",
                "duration": 0.5,
                "hold": 4,
                "exit": "fade_out"
            },
            "suggested_effects": [
                "parallax_layers",
                "particle_overlay",
                "subtle_camera_shake" if "energy" in scene.get("title", "").lower() else None
            ]
        }

# Test
if __name__ == "__main__":
    print("✅ Motion prompt templates loaded")
    print("🎬 Available variations:", list(MotionPromptTemplates.VARIATION_TEMPLATES.keys()))
