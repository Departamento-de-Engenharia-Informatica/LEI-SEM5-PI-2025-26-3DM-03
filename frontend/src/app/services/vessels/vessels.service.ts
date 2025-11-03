import { Injectable } from '@angular/core';
import axios from 'axios';

@Injectable({
  providedIn: 'root'
})
export class VesselsService {
  private apiUrl = 'https://localhost:5001/api/vessels'; // muda para o endpoint real

  async getAll() {
    const response = await axios.get(this.apiUrl);
    return response.data;
  }

  async getById(id: number) {
    const response = await axios.get(`${this.apiUrl}/${id}`);
    return response.data;
  }

  async create(vessel: any) {
    const response = await axios.post(this.apiUrl, vessel);
    return response.data;
  }

  async update(id: number, vessel: any) {
    const response = await axios.put(`${this.apiUrl}/${id}`, vessel);
    return response.data;
  }

  async delete(id: number) {
    await axios.delete(`${this.apiUrl}/${id}`);
  }
}
