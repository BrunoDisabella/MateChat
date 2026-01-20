import os

crm_path = os.path.join(os.getcwd(), 'Mi Extension', 'crm_logic.js')
temp_path = os.path.join(os.getcwd(), 'Mi Extension', 'temp_config_module.js')

try:
    with open(crm_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Split at the known header of the appended part
    split_key = '// ==========================================\n// 10. MÓDULO: CONFIGURACIÓN MATECHAT'
    if split_key in content:
        content = content.split(split_key)[0]

    # Clean up trailing garbage (null bytes, etc)
    content = content.rstrip('\x00').strip()

    # Read the temp module
    with open(temp_path, 'r', encoding='utf-8') as f:
        new_module = f.read()

    # Combine
    final_content = content + '\n\n' + new_module

    # Write back clean
    with open(crm_path, 'w', encoding='utf-8') as f:
        f.write(final_content)
    
    print("SUCCESS: Repaired crm_logic.js")

except Exception as e:
    print(f"ERROR: {e}")
