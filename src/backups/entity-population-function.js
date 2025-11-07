
    // ===== POPULATE ENTITY DROPDOWN =====
    async function populateEntityDropdowns() {
      try {
        // Get config to access entities for current brand
        const config = await callBackend('getConfig');
        const brandConfig = config.BRANDS[currentBrand];
        
        if (!brandConfig || !brandConfig.entities) {
          console.error('No entities found for brand:', currentBrand);
          return;
        }
        
        const entities = brandConfig.entities;
        
        // Populate create form dropdown
        const createDropdown = document.getElementById('entity');
        if (createDropdown) {
          createDropdown.innerHTML = '<option value="">Select entity...</option>';
          entities.forEach(entity => {
            const option = document.createElement('option');
            option.value = entity.id;
            option.textContent = entity.name;
            createDropdown.appendChild(option);
          });
        }
        
        // Populate edit form dropdown (will be used when viewing event)
        const editDropdown = document.querySelector('#eventModal select#entity');
        if (editDropdown) {
          editDropdown.innerHTML = '<option value="">Select entity...</option>';
          entities.forEach(entity => {
            const option = document.createElement('option');
            option.value = entity.id;
            option.textContent = entity.name;
            editDropdown.appendChild(option);
          });
        }
        
        console.log('Entity dropdowns populated with', entities.length, 'entities');
      } catch (error) {
        console.error('Failed to populate entity dropdowns:', error);
        showToast('Failed to load entities', 'error');
      }
    }
