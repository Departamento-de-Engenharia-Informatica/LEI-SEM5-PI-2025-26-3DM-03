using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TodoApi.Application.Services.StorageAreas;
using TodoApi.Domain.Repositories;
using TodoApi.Models.Docks;
using TodoApi.Models.StorageAreas;
using Xunit;

#nullable enable

namespace Domain.Tests.Services
{
    public class StorageAreaServiceTests
    {
        [Fact]
        public async Task RegisterStorageAreaAsync_WhenOccupancyExceedsCapacity_Throws()
        {
            var storageRepo = new FakeStorageAreaRepository();
            var dockRepo = new FakeDockRepository();
            var service = new StorageAreaService(storageRepo, dockRepo);

            var dto = new CreateStorageAreaDTO
            {
                Type = "Yard",
                Location = "North",
                MaxCapacityTEU = 100,
                CurrentOccupancyTEU = 150
            };

            await Assert.ThrowsAsync<InvalidOperationException>(() => service.RegisterStorageAreaAsync(dto));
        }

        [Fact]
        public async Task RegisterStorageAreaAsync_WhenDockMissing_Throws()
        {
            var storageRepo = new FakeStorageAreaRepository();
            var dockRepo = new FakeDockRepository();
            var service = new StorageAreaService(storageRepo, dockRepo);

            var dto = new CreateStorageAreaDTO
            {
                Type = "Yard",
                Location = "North",
                MaxCapacityTEU = 100,
                CurrentOccupancyTEU = 50,
                ServedDockIds = new List<int> { 5 }
            };

            var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.RegisterStorageAreaAsync(dto));
            Assert.Contains("Served dock id 5", ex.Message);
        }

        [Fact]
        public async Task RegisterStorageAreaAsync_PersistsWhenValid()
        {
            var storageRepo = new FakeStorageAreaRepository();
            var dockRepo = new FakeDockRepository();
            dockRepo.Seed(new Dock { Id = 5 });
            var service = new StorageAreaService(storageRepo, dockRepo);

            var dto = new CreateStorageAreaDTO
            {
                Type = "Warehouse",
                Location = "South",
                MaxCapacityTEU = 200,
                CurrentOccupancyTEU = 120,
                ServedDockIds = new List<int> { 5 }
            };

            var result = await service.RegisterStorageAreaAsync(dto);

            Assert.NotEqual(0, result.Id);
            Assert.Single(storageRepo.Items);
            Assert.Equal(result.Id, storageRepo.Items.Single().Id);
        }

        [Fact]
        public async Task UpdateStorageAreaAsync_WhenAreaMissing_Throws()
        {
            var storageRepo = new FakeStorageAreaRepository();
            var dockRepo = new FakeDockRepository();
            var service = new StorageAreaService(storageRepo, dockRepo);

            await Assert.ThrowsAsync<KeyNotFoundException>(() => service.UpdateStorageAreaAsync(1, new UpdateStorageAreaDTO())) ;
        }

        [Fact]
        public async Task UpdateStorageAreaAsync_WhenDockMissing_Throws()
        {
            var storageRepo = new FakeStorageAreaRepository();
            var dockRepo = new FakeDockRepository();
            var existing = new StorageArea { Id = 1, MaxCapacityTEU = 100, CurrentOccupancyTEU = 50 };
            storageRepo.Seed(existing);
            var service = new StorageAreaService(storageRepo, dockRepo);

            var dto = new UpdateStorageAreaDTO
            {
                ServedDockIds = new List<int> { 9 }
            };

            var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateStorageAreaAsync(1, dto));
            Assert.Contains("Served dock id 9", ex.Message);
        }

        [Fact]
        public async Task UpdateStorageAreaAsync_WhenOccupancyTooHigh_Throws()
        {
            var storageRepo = new FakeStorageAreaRepository();
            var dockRepo = new FakeDockRepository();
            var existing = new StorageArea { Id = 1, MaxCapacityTEU = 100, CurrentOccupancyTEU = 50 };
            storageRepo.Seed(existing);
            var service = new StorageAreaService(storageRepo, dockRepo);

            var dto = new UpdateStorageAreaDTO
            {
                CurrentOccupancyTEU = 200
            };

            await Assert.ThrowsAsync<InvalidOperationException>(() => service.UpdateStorageAreaAsync(1, dto));
        }

        private class FakeStorageAreaRepository : IStorageAreaRepository
        {
            private readonly Dictionary<int, StorageArea> _items = new();
            private int _nextId = 1;

            public IEnumerable<StorageArea> Items => _items.Values;

            public Task AddAsync(StorageArea entity)
            {
                if (entity.Id == 0)
                {
                    entity.Id = _nextId++;
                }

                _items[entity.Id] = entity;
                return Task.CompletedTask;
            }

            public Task DeleteAsync(StorageArea entity)
            {
                _items.Remove(entity.Id);
                return Task.CompletedTask;
            }

            public Task<IEnumerable<StorageArea>> GetAllAsync(string? type = null, string? location = null, int? servedDockId = null)
            {
                return Task.FromResult(_items.Values.AsEnumerable());
            }

            public Task<StorageArea?> GetByIdAsync(int id)
            {
                _items.TryGetValue(id, out var entity);
                return Task.FromResult(entity);
            }

            public void Seed(StorageArea entity)
            {
                if (entity.Id == 0)
                {
                    entity.Id = _nextId++;
                }
                _items[entity.Id] = entity;
            }

            public Task SaveChangesAsync() => Task.CompletedTask;

            public Task UpdateAsync(StorageArea entity)
            {
                _items[entity.Id] = entity;
                return Task.CompletedTask;
            }
        }

        private class FakeDockRepository : IDockRepository
        {
            private readonly Dictionary<long, Dock> _items = new();

            public void Seed(Dock dock)
            {
                _items[dock.Id] = dock;
            }

            public Task AddAsync(Dock entity)
            {
                _items[entity.Id] = entity;
                return Task.CompletedTask;
            }

            public Task DeleteAsync(Dock entity)
            {
                _items.Remove(entity.Id);
                return Task.CompletedTask;
            }

            public Task<IEnumerable<Dock>> GetAllAsync(string? name = null, long? vesselTypeId = null, string? location = null)
            {
                return Task.FromResult(_items.Values.AsEnumerable());
            }

            public Task<Dock?> GetByIdAsync(long id)
            {
                _items.TryGetValue(id, out var entity);
                return Task.FromResult(entity);
            }

            public Task SaveChangesAsync() => Task.CompletedTask;

            public Task UpdateAsync(Dock entity)
            {
                _items[entity.Id] = entity;
                return Task.CompletedTask;
            }
        }
    }
}
