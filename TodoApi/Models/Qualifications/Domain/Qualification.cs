using FrameworkDDD.Common;

namespace TodoApi.Models.Qualifications

{
    public class Qualification : IAggregateRoot
    {
        public string Code { get; set; } = string.Empty; // Primary key, codigo da qualificação
        public string Description { get; set; } = string.Empty; // Descriçao da qualificação

        // Construtor vazio 
        public Qualification() { }

        // Construtor 
        public Qualification(string code, string description)
        {
            Code = code;
            Description = description;
        }
    }
}