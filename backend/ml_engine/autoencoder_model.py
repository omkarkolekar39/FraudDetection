import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np

class FraudAutoencoder(nn.Module):
    def __init__(self, input_dim):
        super(FraudAutoencoder, self).__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 16),
            nn.ReLU(True),
            nn.Linear(16, 8),
            nn.ReLU(True),
            nn.Linear(8, 4)
        )
        self.decoder = nn.Sequential(
            nn.Linear(4, 8),
            nn.ReLU(True),
            nn.Linear(8, 16),
            nn.ReLU(True),
            nn.Linear(16, input_dim)
        )

    def forward(self, x):
        return self.decoder(self.encoder(x))

def train_and_score_autoencoder(data: np.ndarray, epochs: int = 12, lr: float = 0.01, max_train_rows: int = 5000):
    input_dim = data.shape[1]
    model = FraudAutoencoder(input_dim)
    criterion = nn.MSELoss(reduction='none')
    optimizer = optim.Adam(model.parameters(), lr=lr)

    if len(data) > max_train_rows:
        sample_indices = np.linspace(0, len(data) - 1, num=max_train_rows, dtype=int)
        train_data = data[sample_indices]
    else:
        train_data = data

    tensor_train_data = torch.FloatTensor(train_data)
    tensor_data = torch.FloatTensor(data)

    model.train()
    for _ in range(epochs):
        optimizer.zero_grad()
        outputs = model(tensor_train_data)
        loss = criterion(outputs, tensor_train_data).mean()
        loss.backward()
        optimizer.step()

    model.eval()
    with torch.no_grad():
        final_outputs = model(tensor_data)
        # Average error per row
        errors = criterion(final_outputs, tensor_data).mean(dim=1).numpy()

    return model, errors
