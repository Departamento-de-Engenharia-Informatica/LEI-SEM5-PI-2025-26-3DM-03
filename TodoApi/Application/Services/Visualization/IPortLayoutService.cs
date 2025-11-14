using System.Threading.Tasks;

namespace TodoApi.Application.Services.Visualization
{
    public interface IPortLayoutService
    {
        Task<PortLayoutDto> BuildLayoutAsync();
    }
}

