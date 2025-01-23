<template>
    <div class="admin-container">
        <h1>Places Admin</h1>
        
        <!-- Create/Edit Form -->
        <div class="form-container">
            <h2>{{ editingId ? 'Edit Place' : 'Create New Place' }}</h2>
            <form @submit.prevent="handleSubmit" class="place-form">
                <div class="form-group">
                    <label>Name:</label>
                    <input v-model="form.name" required>
                </div>
                <div class="form-group">
                    <label>Description:</label>
                    <textarea v-model="form.description" required></textarea>
                </div>
                <div class="form-group coordinates">
                    <label>Coordinates:</label>
                    <div class="coordinate-inputs">
                        <input type="number" v-model.number="form.coordinates.north" required placeholder="North">
                        <input type="number" v-model.number="form.coordinates.west" required placeholder="West">
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" :disabled="isLoading">{{ editingId ? 'Update' : 'Create' }}</button>
                    <button type="button" @click="resetForm" :disabled="isLoading">Cancel</button>
                </div>
            </form>
        </div>

        <!-- Places List -->
        <div class="places-list">
            <h2>Existing Places</h2>
            <div v-if="isLoading" class="loading">Loading...</div>
            <div v-else-if="places.length === 0" class="no-places">No places created yet.</div>
            <div v-else class="places-grid">
                <div v-for="place in places" :key="place.id" class="place-card">
                    <div class="place-header">
                        <h3>{{ place.name }}</h3>
                        <div class="coordinates-badge">{{ getCoordinatesString(place.coordinates) }}</div>
                    </div>
                    <p class="description">{{ place.description }}</p>
                    <div class="card-actions">
                        <button @click="editPlace(place)" :disabled="isLoading">Edit</button>
                        <button @click="deletePlace(place.id)" :disabled="isLoading" class="delete">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Place } from '~/server/types/place'
import { getCoordinatesString } from '~/server/types/place'

const places = ref<Place[]>([])
const isLoading = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
    name: '',
    description: '',
    coordinates: {
        north: 0,
        west: 0
    }
})

// Load all places
async function loadPlaces() {
    isLoading.value = true
    try {
        const response = await fetch('/api/places')
        const data = await response.json()
        places.value = data.places
    } catch (error) {
        console.error('Error loading places:', error)
        alert('Failed to load places')
    } finally {
        isLoading.value = false
    }
}

// Handle form submission (create/update)
async function handleSubmit() {
    isLoading.value = true
    try {
        const url = editingId.value 
            ? `/api/places/${editingId.value}`
            : '/api/places'
        
        const method = editingId.value ? 'PUT' : 'POST'
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(form.value)
        })
        
        const data = await response.json()
        
        if (data.error) {
            throw new Error(data.error)
        }
        
        await loadPlaces()
        resetForm()
    } catch (error: any) {
        console.error('Error saving place:', error)
        alert(error.message || 'Failed to save place')
    } finally {
        isLoading.value = false
    }
}

// Delete a place
async function deletePlace(id: string | undefined) {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this place?')) return;
    
    isLoading.value = true;
    try {
        const response = await fetch(`/api/places/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        await loadPlaces();
    } catch (error: any) {
        console.error('Error deleting place:', error);
        alert(error.message || 'Failed to delete place');
    } finally {
        isLoading.value = false;
    }
}

// Edit a place
function editPlace(place: Place) {
    editingId.value = place.id || null;
    form.value = {
        name: place.name,
        description: place.description,
        coordinates: { ...place.coordinates }
    };
}

// Reset form
function resetForm() {
    editingId.value = null
    form.value = {
        name: '',
        description: '',
        coordinates: {
            north: 0,
            west: 0
        }
    }
}

onMounted(loadPlaces)
</script>

<style scoped>
.admin-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Courier New', monospace;
}

h1, h2 {
    color: #33ff33;
    margin-bottom: 20px;
}

.form-container {
    background: #1a1a1a;
    padding: 20px;
    border-radius: 5px;
    margin-bottom: 30px;
    border: 2px solid #33ff33;
}

.place-form {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.form-group label {
    color: #33ff33;
}

input, textarea {
    padding: 8px;
    background: #000;
    border: 1px solid #33ff33;
    border-radius: 4px;
    color: #33ff33;
    font-family: 'Courier New', monospace;
}

textarea {
    min-height: 100px;
    resize: vertical;
}

.coordinates {
    .coordinate-inputs {
        display: flex;
        gap: 10px;
        
        input {
            width: 100px;
        }
    }
}

.form-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

button {
    padding: 8px 16px;
    background: #000;
    border: 2px solid #33ff33;
    color: #33ff33;
    border-radius: 4px;
    cursor: pointer;
    font-family: 'Courier New', monospace;
    transition: all 0.3s ease;
    
    &:hover:not(:disabled) {
        background: #33ff33;
        color: #000;
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    &.delete {
        border-color: #ff3333;
        color: #ff3333;
        
        &:hover:not(:disabled) {
            background: #ff3333;
            color: #000;
        }
    }
}

.places-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
}

.place-card {
    background: #1a1a1a;
    border: 2px solid #33ff33;
    border-radius: 5px;
    padding: 15px;
    
    .place-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        
        h3 {
            margin: 0;
            color: #33ff33;
        }
    }
    
    .coordinates-badge {
        background: #000;
        color: #33ff33;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.9em;
    }
    
    .description {
        color: #fff;
        margin-bottom: 15px;
    }
    
    .card-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    }
}

.loading {
    text-align: center;
    color: #33ff33;
    font-size: 1.2em;
    padding: 20px;
}

.no-places {
    text-align: center;
    color: #666;
    padding: 20px;
}

@media (max-width: 600px) {
    .admin-container {
        padding: 10px;
    }
    
    .places-grid {
        grid-template-columns: 1fr;
    }
}
</style> 