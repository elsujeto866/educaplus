export class ExampleEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {
    if (!id) throw new Error('ExampleEntity: id is required');
  }
}
