import os
import json
import openai
import google.generativeai as genai

class AIPipelines:
    def __init__(self, secrets_path="secrets.json", template_path="templates/Base.idf"):
        # 1. Load Secrets
        self.api_keys = {}
        if os.path.exists(secrets_path):
            with open(secrets_path, "r") as f:
                self.api_keys = json.load(f)
        else:
            print(f"[AI] Warning: {secrets_path} not found. AI generation will fail.")

        # 2. Configure OpenAI
        if "OPENAI_API_KEY" in self.api_keys:
            self.openai_client = openai.OpenAI(api_key=self.api_keys["OPENAI_API_KEY"])
        else:
            self.openai_client = None

        # 3. Configure Gemini
        if "GEMINI_API_KEY" in self.api_keys:
            genai.configure(api_key=self.api_keys["GEMINI_API_KEY"])
            self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.gemini_model = None

        # 4. Load Base Template
        self.base_idf = ""
        if os.path.exists(template_path):
            with open(template_path, "r") as f:
                self.base_idf = f.read()
        else:
             print(f"[AI] Warning: {template_path} not found. Using empty string.")

    def generate_idf_from_text(self, nlp_text, config, model_type="openai"):
        """
        Generates a modified IDF based on the Base Template.
        Args:
            nlp_text (str): User's natural language request.
            config (dict): Simulation configuration (Location, Duration).
            model_type (str): 'openai' or 'gemini'.
        Returns:
            str: Valid IDF content.
        """
        print(f"[AI] Generating IDF using model: {model_type}")

        # Construct Prompt
        system_prompt = (
            "You are an EnergyPlus expert. Your goal is to modify the provided Base Template IDF "
            "to match the user's requirements. \n"
            "RULES:\n"
            "1. Return ONLY the valid IDF content. Do not output markdown code blocks (```).\n"
            "2. Do NOT break the geometry if not asked.\n"
            "3. If the user asks for a feature not in the template, add the necessary EnergyPlus objects.\n"
            f"4. Use the Weather File provided in the config: {config.get('weatherFilePath', 'Unknown')}\n"
            "5. Remove internal heat loads (People, Lights, ElectricEquipment) if requested."
        )

        user_prompt = (
            f"BASE TEMPLATE:\n{self.base_idf}\n\n"
            f"USER TASK: {nlp_text}\n"
            f"CONFIG: {json.dumps(config)}\n\n"
            "OUTPUT FULL VALID IDF:"
        )

        try:
            if model_type == "openai":
                return self._call_openai(system_prompt, user_prompt)
            elif model_type == "gemini":
                return self._call_gemini(system_prompt, user_prompt)
            else:
                return f"! Error: Unknown model type '{model_type}'"
        except Exception as e:
            print(f"[AI] Error generating IDF: {e}")
            return f"! Analysis Error: {str(e)}"

    def _call_openai(self, system, user):
        if not self.openai_client:
            raise ValueError("OpenAI API Key missing in secrets.json")
            
        response = self.openai_client.chat.completions.create(
            model="gpt-4o", # Or gpt-3.5-turbo
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            temperature=0.2
        )
        content = response.choices[0].message.content
        return self._sanitize_output(content)

    def _call_gemini(self, system, user):
        if not self.gemini_model:
            raise ValueError("Gemini API Key missing in secrets.json")
            
        # Gemini often prefers combined prompts or chat history
        full_prompt = f"{system}\n\n{user}"
        response = self.gemini_model.generate_content(full_prompt)
        return self._sanitize_output(response.text)

    def _sanitize_output(self, text):
        """Removes markdown wrappers if present."""
        clean = text.strip()
        if clean.startswith("```"):
            # Find first newline
            first_newline = clean.find("\n")
            if first_newline != -1:
                clean = clean[first_newline+1:]
        if clean.endswith("```"):
            clean = clean[:-3]
        return clean.strip()
